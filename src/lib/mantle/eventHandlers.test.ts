import { beforeEach, describe, expect, mock, test } from "bun:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const mockEmitAudit = mock(() => {});

// Capture the values passed to each insert inside the transaction. The first
// insert per transaction is the journal entry (it calls `.returning()`); the
// remaining inserts are journal lines + the reconciliation queue item
const insertedEntryValues: Array<Record<string, unknown>> = [];

let entrySeq = 0;
// When true, the journal-entry insert returns no row, simulating a concurrent
// insert that won the (book, source, source_reference_id) unique-constraint race
let entryInsertReturnsEmpty = false;
const txInsertValues = mock((values: Record<string, unknown>) => {
  // Only the journal entry insert carries `source`; capture those
  if (values.source !== undefined) {
    insertedEntryValues.push(values);
  }

  const returning = mock(() =>
    entryInsertReturnsEmpty ? [] : [{ id: `entry-${++entrySeq}` }],
  );

  // The entry insert chains `.onConflictDoNothing(...).returning()`; the line
  // and reconciliation inserts just await `.values(...)`
  return {
    returning,
    onConflictDoNothing: mock(() => ({ returning })),
  };
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock(() => ({
      values: txInsertValues,
    })),
  };

  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));
mock.module("lib/audit", () => ({
  emitAudit: mockEmitAudit,
  SYSTEM_ACTOR: { id: "system", name: "MyFi System" },
}));

const { default: handleMantleEvent, mantleDedupCondition } = await import(
  "./eventHandlers"
);

const ORG = "org-1";
const INVOICE_ID = "inv-1";
const book = { id: "book-1", organizationId: ORG, name: "Main Book" };
const mapping = {
  bookId: "book-1",
  debitAccountId: "acct-debit",
  creditAccountId: "acct-credit",
};

/** Queue the three selects a single createJournalEntry call performs. */
const queueEntryLookups = (existing: Array<{ id: string }> = []) => {
  // 1: book lookup, 2: dedup lookup, 3: account mapping lookup
  setSelectResults([[book], existing, [mapping]]);
};

const legacyEvent = (event: string) =>
  ({
    event,
    data: {
      organizationId: ORG,
      referenceId: INVOICE_ID,
      amount: 100,
    },
  }) as const;

describe("handleMantleEvent journal dedup (MYFI-1)", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
    mockTransaction.mockClear();
    txInsertValues.mockClear();
    insertedEntryValues.length = 0;
    entrySeq = 0;
    entryInsertReturnsEmpty = false;
  });

  test("sent -> paid -> void for one invoice posts three distinct entries", async () => {
    for (const event of ["invoice.sent", "invoice.paid", "invoice.void"]) {
      queueEntryLookups();
      const result = await handleMantleEvent(legacyEvent(event));
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    }

    // Three separate journal entries were written, one per lifecycle event
    expect(mockTransaction).toHaveBeenCalledTimes(3);
    expect(insertedEntryValues).toHaveLength(3);

    const refs = insertedEntryValues.map((v) => v.sourceReferenceId);

    // Each entry is keyed by invoice id + accounting event, so all three are
    // distinct (the bug keyed on the invoice id alone, collapsing them to one)
    expect(refs).toEqual([
      `${INVOICE_ID}:invoice.sent`,
      `${INVOICE_ID}:invoice.paid`,
      `${INVOICE_ID}:invoice.void`,
    ]);
    expect(new Set(refs).size).toBe(3);
  });

  test("a repeated identical event for the same invoice posts nothing", async () => {
    // First invoice.sent: no existing entry, so it posts
    queueEntryLookups();
    const first = await handleMantleEvent(legacyEvent("invoice.sent"));
    expect(first.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(insertedEntryValues).toHaveLength(1);
    expect(insertedEntryValues[0]?.sourceReferenceId).toBe(
      `${INVOICE_ID}:invoice.sent`,
    );

    // Replay of the same invoice.sent: dedup lookup finds the existing entry
    queueEntryLookups([{ id: "entry-1" }]);
    const replay = await handleMantleEvent(legacyEvent("invoice.sent"));

    expect(replay.success).toBe(true);
    expect(replay.journalEntryId).toBe("entry-1");
    expect(replay.error).toBe("Duplicate event, entry already exists");

    // No new entry was written for the replay
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(insertedEntryValues).toHaveLength(1);
  });
});

describe("handleMantleEvent fail-closed on transient failures (MYFI-2)", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
    mockTransaction.mockClear();
    txInsertValues.mockClear();
    insertedEntryValues.length = 0;
    entrySeq = 0;
    entryInsertReturnsEmpty = false;
  });

  test("an unmapped-account event is retryable (maps to non-2xx) and posts nothing", async () => {
    // book found, no existing entry, but NO account mapping configured yet
    setSelectResults([[book], [], []]);

    const result = await handleMantleEvent(legacyEvent("invoice.sent"));

    // The admin may not have finished mapping the account; the event must be
    // redelivered, not acked and dropped
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(insertedEntryValues).toHaveLength(0);
  });

  test("an event for an org with no book is retryable", async () => {
    // book lookup returns nothing
    setSelectResults([[]]);

    const result = await handleMantleEvent(legacyEvent("invoice.sent"));

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("an unsupported event is terminal, not retryable", async () => {
    const result = await handleMantleEvent(legacyEvent("invoice.exploded"));

    expect(result.success).toBe(false);
    expect(result.retryable).toBeUndefined();
  });
});

describe("handleMantleEvent tenant-scoped dedup (MYFI-2)", () => {
  const LEGACY_REF = "1001";
  const bookA = { id: "book-a", organizationId: "org-a", name: "Book A" };
  const bookB = { id: "book-b", organizationId: "org-b", name: "Book B" };

  const orgEvent = (organizationId: string) => ({
    event: "invoice.sent",
    data: { organizationId, referenceId: LEGACY_REF, amount: 100 },
  });

  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
    mockTransaction.mockClear();
    txInsertValues.mockClear();
    insertedEntryValues.length = 0;
    entrySeq = 0;
    entryInsertReturnsEmpty = false;
  });

  test("the same referenceId in two different orgs posts two entries", async () => {
    // Org A: its own book + mapping, no existing entry
    setSelectResults([[bookA], [], [mapping]]);
    const resultA = await handleMantleEvent(orgEvent("org-a"));
    expect(resultA.success).toBe(true);
    expect(resultA.error).toBeUndefined();

    // Org B: same legacy referenceId "1001", its own book + mapping, no
    // existing entry (dedup is scoped by book, so A's entry does not match B)
    setSelectResults([[bookB], [], [mapping]]);
    const resultB = await handleMantleEvent(orgEvent("org-b"));
    expect(resultB.success).toBe(true);
    expect(resultB.error).toBeUndefined();

    // Both orgs posted their own entry, keyed by the same source reference but
    // scoped to different books
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(insertedEntryValues).toHaveLength(2);
    expect(insertedEntryValues.map((v) => v.sourceReferenceId)).toEqual([
      `${LEGACY_REF}:invoice.sent`,
      `${LEGACY_REF}:invoice.sent`,
    ]);
    expect(insertedEntryValues.map((v) => v.bookId)).toEqual([
      bookA.id,
      bookB.id,
    ]);
  });

  test("the dedup predicate is scoped by book, source, and reference", () => {
    const dialect = new PgDialect();
    const condition = mantleDedupCondition("book-42", "1001:invoice.sent");
    expect(condition).toBeDefined();

    const { sql, params } = dialect.sqlToQuery(condition!);

    // Scoped by book_id (the fix): a cross-org reference cannot match
    expect(sql).toContain("book_id");
    expect(params).toContain("book-42");
    expect(params).toContain("mantle_sync");
    expect(params).toContain("1001:invoice.sent");
  });

  test("a concurrent identical post inserts once (onConflictDoNothing race)", async () => {
    // Pre-check passes (no existing entry) but the insert loses the race: the
    // unique constraint makes onConflictDoNothing return no row
    setSelectResults([[bookA], [], [mapping]]);
    entryInsertReturnsEmpty = true;

    const result = await handleMantleEvent(orgEvent("org-a"));

    // Treated as a duplicate, no new entry written
    expect(result.success).toBe(true);
    expect(result.error).toBe("Duplicate event, entry already exists");
    expect(result.journalEntryId).toBeUndefined();

    // Only the entry insert was attempted; no lines or reconciliation item
    // followed once the race was detected
    expect(txInsertValues).toHaveBeenCalledTimes(1);
  });
});
