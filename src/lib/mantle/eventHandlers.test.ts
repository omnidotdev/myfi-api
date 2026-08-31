import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const mockEmitAudit = mock(() => {});

// Capture the values passed to each insert inside the transaction. The first
// insert per transaction is the journal entry (it calls `.returning()`); the
// remaining inserts are journal lines + the reconciliation queue item
const insertedEntryValues: Array<Record<string, unknown>> = [];

let entrySeq = 0;
const txInsertValues = mock((values: Record<string, unknown>) => {
  // Only the journal entry insert carries `source`; capture those
  if (values.source !== undefined) {
    insertedEntryValues.push(values);
  }

  return {
    returning: mock(() => [{ id: `entry-${++entrySeq}` }]),
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

const { default: handleMantleEvent } = await import("./eventHandlers");

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
