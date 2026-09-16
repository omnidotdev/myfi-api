import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    insertedEntry = values;
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  insertedLines.push(values);
  return {};
});
const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = { insert: mock(() => ({ values: txInsertValues })) };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { materializeRecurring } = await import("./materializeRecurring");

const recurring = {
  id: "r1",
  bookId: "b1",
  name: "Rent",
  amount: "1000",
  frequency: "monthly",
  accountId: "rent",
  counterAccountId: "cash",
  isAutoDetected: false,
  isActive: true,
  nextExpectedDate: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

beforeEach(() => {
  resetDbMock();
  insertedEntry = null;
  insertedLines.length = 0;
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("materializeRecurring", () => {
  test("posts a due occurrence and advances the schedule", async () => {
    setSelectResults([[]]); // dedup check: no existing entry
    const result = await materializeRecurring(recurring as never, "2026-03-15");

    expect(insertedEntry).toMatchObject({
      bookId: "b1",
      date: "2026-03-01",
      source: "recurring",
      sourceReferenceId: "r1:2026-03-01",
      memo: "Rent",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "entry-1",
        accountId: "rent",
        debit: "1000.0000",
        credit: "0.0000",
      },
      {
        journalEntryId: "entry-1",
        accountId: "cash",
        debit: "0.0000",
        credit: "1000.0000",
      },
    ]);
    expect(result).toEqual({
      recurringTransactionId: "r1",
      posted: 1,
      nextExpectedDate: "2026-04-01",
    });
  });

  test("is idempotent when the occurrence already exists", async () => {
    setSelectResults([[{ id: "existing" }]]); // dedup finds an entry
    const result = await materializeRecurring(recurring as never, "2026-03-15");

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(result.posted).toBe(0);
    expect(result.nextExpectedDate).toBe("2026-04-01");
  });

  test("catches up multiple missed occurrences", async () => {
    // due 2026-03-01, asOf 2026-05-15 -> Mar, Apr, May = 3 occurrences
    setSelectResults([[], [], []]);
    const result = await materializeRecurring(recurring as never, "2026-05-15");

    expect(result.posted).toBe(3);
    expect(result.nextExpectedDate).toBe("2026-06-01");
  });

  test("skips a transaction without a counter account", async () => {
    const result = await materializeRecurring(
      { ...recurring, counterAccountId: null } as never,
      "2026-03-15",
    );
    expect(result.posted).toBe(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
