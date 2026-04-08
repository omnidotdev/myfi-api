import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

const mockCategorize = mock((): Promise<unknown> => Promise.resolve(null));
mock.module("lib/categorization", () => ({
  default: mockCategorize,
  categorize: mockCategorize,
  AUTO_APPROVE_THRESHOLD: 0.9,
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { hashTransaction, importTransactions } = await import(
  "./importTransactions"
);

describe("importTransactions", () => {
  beforeEach(() => {
    resetDbMock();
    mockCategorize.mockClear();
    // Default: categorize returns null (uncategorized)
    mockCategorize.mockResolvedValue(null);
  });

  test("processes all transactions through pipeline", async () => {
    // Two hash dedup checks (no existing) + two book lookups
    setSelectResults([[], [{ type: "business" }], [], [{ type: "business" }]]);
    setInsertReturningData([{ id: "entry-1" }]);

    const result = await importTransactions({
      bookId: "book-1",
      source: "csv_import",
      transactions: [
        { date: "2026-04-08", amount: 25, memo: "Test 1" },
        { date: "2026-04-08", amount: 50, memo: "Test 2" },
      ],
    });

    expect(result.addedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(mockCategorize).toHaveBeenCalledTimes(2);
  });

  test("skips duplicate transactions by referenceId", async () => {
    // Dedup check finds existing entry
    setSelectResults([[{ id: "existing-1" }]]);

    const result = await importTransactions({
      bookId: "book-1",
      source: "ofx_import",
      transactions: [
        { date: "2026-04-08", amount: 25, memo: "Dup", referenceId: "ref-1" },
      ],
    });

    expect(result.addedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(mockCategorize).not.toHaveBeenCalled();
  });

  test("never silently drops uncategorized transactions", async () => {
    // Hash dedup (no existing) + book lookup
    setSelectResults([[], [{ type: "business" }]]);
    setInsertReturningData([{ id: "entry-1" }]);
    mockCategorize.mockResolvedValueOnce(null);

    const result = await importTransactions({
      bookId: "book-1",
      source: "csv_import",
      transactions: [
        { date: "2026-04-08", amount: 25, memo: "Unknown vendor" },
      ],
    });

    // Must be added, not skipped
    expect(result.addedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    // Entry must have been inserted even without categorization
    expect(mockInsertValues).toHaveBeenCalled();
  });
});

describe("hashTransaction", () => {
  test("generates consistent hash for same transaction", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-15", 45, "Grocery Store");
    expect(hash1).toBe(hash2);
  });

  test("generates different hashes for different transactions", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-16", 45, "Grocery Store");
    const hash3 = hashTransaction("2026-03-15", 50, "Grocery Store");
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test("normalizes memo whitespace and casing", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-15", 45, "  grocery store  ");
    expect(hash1).toBe(hash2);
  });
});
