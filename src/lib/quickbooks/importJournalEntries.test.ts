import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock } from "lib/test/mockDb";

import type { QboEntryInput, QboLine } from "./importJournalEntries";

// Capture the values passed to each insert inside a per-entry transaction. The
// journal-entry insert carries `source` and chains `.onConflictDoNothing(...)
// .returning()`; the journal-line inserts just await `.values(...)`
const insertedEntryValues: Array<Record<string, unknown>> = [];
const insertedLineValues: Array<Record<string, unknown>> = [];

// Queue controlling whether each successive journal-entry insert returns a row
// (a new entry) or no row (a conflict = already imported). Consumed in order
let entryReturns: boolean[] = [];
let entryReturnIndex = 0;
let entrySeq = 0;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    // Journal entry insert
    insertedEntryValues.push(values);
    const isNew = entryReturns[entryReturnIndex++] ?? true;
    const returning = mock(() =>
      isNew ? [{ id: `entry-${++entrySeq}` }] : [],
    );

    return {
      returning,
      onConflictDoNothing: mock(() => ({ returning })),
    };
  }

  // Journal line insert
  insertedLineValues.push(values);
  return {};
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock(() => ({ values: txInsertValues })),
  };

  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

// Query param forces a fresh, unmocked module instance, bypassing the
// mock.module registered for "./importJournalEntries" by backfill.test.ts
// @ts-expect-error -- query-param import has no type declarations
const { importJournalEntries } = await import("./importJournalEntries.ts?real");

const DATE = "2026-01-01T00:00:00.000Z";

/** A balanced two-line entry using the given mapped account ids. */
const balancedEntry = (
  qboEntryId: string,
  amount = 100,
  aAccount = "qbo-1",
  bAccount = "qbo-2",
): QboEntryInput => {
  const lines: QboLine[] = [
    { qboAccountId: aAccount, debit: amount, credit: 0 },
    { qboAccountId: bAccount, debit: 0, credit: amount },
  ];

  return { qboEntryId, date: DATE, lines };
};

const defaultMap = () =>
  new Map([
    ["qbo-1", "acct-1"],
    ["qbo-2", "acct-2"],
  ]);

describe("importJournalEntries", () => {
  beforeEach(() => {
    resetDbMock();
    insertedEntryValues.length = 0;
    insertedLineValues.length = 0;
    entryReturns = [];
    entryReturnIndex = 0;
    entrySeq = 0;
    txInsertValues.mockClear();
    mockTransaction.mockClear();
  });

  test("throws and writes nothing when an entry does not balance", async () => {
    await expect(
      importJournalEntries({
        bookId: "book-1",
        accountMap: defaultMap(),
        entries: [
          {
            qboEntryId: "je-1",
            date: DATE,
            lines: [
              { qboAccountId: "qbo-1", debit: 100, credit: 0 },
              { qboAccountId: "qbo-2", debit: 0, credit: 90 },
            ],
          },
        ],
      }),
    ).rejects.toThrow("QuickBooks entry je-1 does not balance");

    expect(insertedEntryValues).toHaveLength(0);
    expect(insertedLineValues).toHaveLength(0);
  });

  test("rejects an entry off by exactly one minimal unit", async () => {
    // 100.0001 vs 100.0000 is 1000001 vs 1000000 ten-thousandths: the integer
    // equality check rejects it (no epsilon that would let a one-unit gap pass)
    await expect(
      importJournalEntries({
        bookId: "book-1",
        accountMap: defaultMap(),
        entries: [
          {
            qboEntryId: "je-1",
            date: DATE,
            lines: [
              { qboAccountId: "qbo-1", debit: 100.0001, credit: 0 },
              { qboAccountId: "qbo-2", debit: 0, credit: 100.0 },
            ],
          },
        ],
      }),
    ).rejects.toThrow("QuickBooks entry je-1 does not balance");

    expect(insertedEntryValues).toHaveLength(0);
    expect(insertedLineValues).toHaveLength(0);
  });

  test("balances entries whose line amounts carry binary-float noise", async () => {
    entryReturns = [true];

    // 0.1 + 0.2 is 0.30000000000000004 in float, but rounding each line to
    // ten-thousandths (1000 + 2000 === 3000) makes the entry balance exactly
    const result = await importJournalEntries({
      bookId: "book-1",
      accountMap: new Map([
        ["qbo-1", "acct-1"],
        ["qbo-2", "acct-2"],
        ["qbo-3", "acct-3"],
      ]),
      entries: [
        {
          qboEntryId: "je-1",
          date: DATE,
          lines: [
            { qboAccountId: "qbo-1", debit: 0.1, credit: 0 },
            { qboAccountId: "qbo-2", debit: 0.2, credit: 0 },
            { qboAccountId: "qbo-3", debit: 0, credit: 0.3 },
          ],
        },
      ],
    });

    expect(result).toEqual({ addedCount: 1, skippedCount: 0 });
  });

  test("throws and writes nothing when an entry has no lines", async () => {
    await expect(
      importJournalEntries({
        bookId: "book-1",
        accountMap: defaultMap(),
        entries: [{ qboEntryId: "je-empty", date: DATE, lines: [] }],
      }),
    ).rejects.toThrow("QuickBooks entry je-empty has no lines");

    expect(insertedEntryValues).toHaveLength(0);
    expect(insertedLineValues).toHaveLength(0);
  });

  test("throws and writes nothing when a line's account is not mapped", async () => {
    await expect(
      importJournalEntries({
        bookId: "book-1",
        accountMap: new Map([["qbo-1", "acct-1"]]),
        entries: [
          {
            qboEntryId: "je-1",
            date: DATE,
            lines: [
              { qboAccountId: "qbo-1", debit: 100, credit: 0 },
              { qboAccountId: "qbo-missing", debit: 0, credit: 100 },
            ],
          },
        ],
      }),
    ).rejects.toThrow(
      "No MyFi account mapped for QuickBooks account qbo-missing",
    );

    expect(insertedEntryValues).toHaveLength(0);
    expect(insertedLineValues).toHaveLength(0);
  });

  test("skips an entry that already exists and writes no lines for it", async () => {
    // The entry insert hits the unique-constraint conflict and returns no row
    entryReturns = [false];

    const result = await importJournalEntries({
      bookId: "book-1",
      accountMap: defaultMap(),
      entries: [balancedEntry("je-1")],
    });

    expect(result).toEqual({ addedCount: 0, skippedCount: 1 });
    expect(insertedLineValues).toHaveLength(0);
  });

  test("writes the entry with quickbooks_import source keyed on the QBO id", async () => {
    entryReturns = [true];

    await importJournalEntries({
      bookId: "book-1",
      accountMap: defaultMap(),
      entries: [{ ...balancedEntry("je-1"), memo: "Sale" }],
    });

    expect(insertedEntryValues).toHaveLength(1);
    expect(insertedEntryValues[0]).toMatchObject({
      bookId: "book-1",
      date: DATE,
      memo: "Sale",
      source: "quickbooks_import",
      sourceReferenceId: "je-1",
    });
  });

  test("writes one mapped journal line per QBO line with string amounts", async () => {
    entryReturns = [true];

    const result = await importJournalEntries({
      bookId: "book-1",
      accountMap: new Map([
        ["qbo-cash", "acct-cash"],
        ["qbo-rev", "acct-rev"],
      ]),
      entries: [
        {
          qboEntryId: "je-1",
          date: DATE,
          lines: [
            { qboAccountId: "qbo-cash", debit: 150.5, credit: 0, memo: "in" },
            { qboAccountId: "qbo-rev", debit: 0, credit: 150.5 },
          ],
        },
      ],
    });

    expect(result).toEqual({ addedCount: 1, skippedCount: 0 });
    expect(insertedLineValues).toHaveLength(2);

    expect(insertedLineValues[0]).toMatchObject({
      journalEntryId: "entry-1",
      accountId: "acct-cash",
      debit: "150.5000",
      credit: "0.0000",
      memo: "in",
    });
    expect(insertedLineValues[1]).toMatchObject({
      journalEntryId: "entry-1",
      accountId: "acct-rev",
      debit: "0.0000",
      credit: "150.5000",
      memo: null,
    });
  });

  test("writes every line of a multi-line split (one debit, two credits)", async () => {
    entryReturns = [true];

    const result = await importJournalEntries({
      bookId: "book-1",
      accountMap: new Map([
        ["qbo-bank", "acct-bank"],
        ["qbo-rent", "acct-rent"],
        ["qbo-utils", "acct-utils"],
      ]),
      entries: [
        {
          qboEntryId: "je-split",
          date: DATE,
          lines: [
            { qboAccountId: "qbo-bank", debit: 100, credit: 0 },
            { qboAccountId: "qbo-rent", debit: 0, credit: 60 },
            { qboAccountId: "qbo-utils", debit: 0, credit: 40 },
          ],
        },
      ],
    });

    expect(result).toEqual({ addedCount: 1, skippedCount: 0 });
    expect(insertedLineValues).toHaveLength(3);

    expect(insertedLineValues[0]).toMatchObject({
      journalEntryId: "entry-1",
      accountId: "acct-bank",
      debit: "100.0000",
      credit: "0.0000",
    });
    expect(insertedLineValues[1]).toMatchObject({
      journalEntryId: "entry-1",
      accountId: "acct-rent",
      debit: "0.0000",
      credit: "60.0000",
    });
    expect(insertedLineValues[2]).toMatchObject({
      journalEntryId: "entry-1",
      accountId: "acct-utils",
      debit: "0.0000",
      credit: "40.0000",
    });
  });

  test("returns added/skipped counts for a mixed new + duplicate batch", async () => {
    // First entry is new, second conflicts (already imported)
    entryReturns = [true, false];

    const result = await importJournalEntries({
      bookId: "book-1",
      accountMap: defaultMap(),
      entries: [balancedEntry("je-new"), balancedEntry("je-dup")],
    });

    expect(result).toEqual({ addedCount: 1, skippedCount: 1 });
    // Only the new entry's two lines are written
    expect(insertedLineValues).toHaveLength(2);
    expect(
      insertedLineValues.every((l) => l.journalEntryId === "entry-1"),
    ).toBe(true);
  });

  test("aborts the whole batch before any write when a later entry is invalid", async () => {
    await expect(
      importJournalEntries({
        bookId: "book-1",
        accountMap: defaultMap(),
        entries: [
          balancedEntry("je-good"),
          {
            qboEntryId: "je-bad",
            date: DATE,
            lines: [
              { qboAccountId: "qbo-1", debit: 100, credit: 0 },
              { qboAccountId: "qbo-2", debit: 0, credit: 90 },
            ],
          },
        ],
      }),
    ).rejects.toThrow("QuickBooks entry je-bad does not balance");

    // The good earlier entry must NOT have been written: validation runs up
    // front so a bad entry anywhere in the batch prevents all partial writes
    expect(insertedEntryValues).toHaveLength(0);
    expect(insertedLineValues).toHaveLength(0);
  });
});
