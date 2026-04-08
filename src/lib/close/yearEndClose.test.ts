import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));
mock.module("lib/audit", () => ({
  emitAudit: mock(() => {}),
  SYSTEM_ACTOR: { id: "system" },
}));

const { default: runYearEndClose } = await import("./yearEndClose");

const makeBook = (overrides: Record<string, unknown> = {}) => ({
  id: "book-1",
  organizationId: "org-1",
  name: "Test Book",
  type: "business",
  currency: "USD",
  fiscalYearStartMonth: 1,
  ...overrides,
});

const makeClosedPeriods = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `period-${i + 1}`,
    bookId: "book-1",
    year: 2025,
    month: i + 1,
    status: "closed",
  }));

describe("runYearEndClose", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("posts closing entries for revenue and expense accounts", async () => {
    setSelectResults([
      // 1: book lookup
      [makeBook()],
      // 2: periods query
      makeClosedPeriods(12),
      // 3: existing year-end close check
      [],
      // 4: revenue balances
      [{ accountId: "rev-1", balance: "5000.0000" }],
      // 5: expense balances
      [{ accountId: "exp-1", balance: "3000.0000" }],
      // 6: retained earnings lookup
      [{ id: "re-1", bookId: "book-1" }],
      // 7: fetch created journal entry
      [{ id: "je-1", bookId: "book-1" }],
    ]);

    const result = await runYearEndClose({
      bookId: "book-1",
      year: 2025,
    });

    expect(result).toEqual({
      bookId: "book-1",
      year: 2025,
      status: "closed",
      netIncome: 2000,
    });

    // Should have called insert for: journal entry + journal lines
    expect(mockInsertValues).toHaveBeenCalledTimes(2);
  });

  test("blocks when not all 12 periods are closed", async () => {
    setSelectResults([
      // 1: book lookup
      [makeBook()],
      // 2: only 10 closed periods
      makeClosedPeriods(10),
    ]);

    const result = await runYearEndClose({
      bookId: "book-1",
      year: 2025,
    });

    expect(result).toEqual({
      status: "blocked",
      reason: "Only 10 of 12 periods are closed",
    });

    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("returns already_closed when entry exists", async () => {
    setSelectResults([
      [makeBook()],
      makeClosedPeriods(12),
      // Existing year-end close entry found
      [{ id: "existing-je" }],
    ]);

    const result = await runYearEndClose({
      bookId: "book-1",
      year: 2025,
    });

    expect(result).toEqual({ status: "already_closed" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("creates retained earnings account when missing", async () => {
    setSelectResults([
      [makeBook()],
      makeClosedPeriods(12),
      [], // no existing close entry
      [{ accountId: "rev-1", balance: "1000.0000" }],
      [], // no expense balances
      [], // no retained earnings account
      // After insert, fetch the new account
      [{ id: "new-re", bookId: "book-1" }],
      // Fetch created journal entry
      [{ id: "je-1", bookId: "book-1" }],
    ]);

    const result = await runYearEndClose({
      bookId: "book-1",
      year: 2025,
    });

    expect(result).toMatchObject({
      status: "closed",
      netIncome: 1000,
    });

    // insert: retained earnings account + journal entry + lines
    expect(mockInsertValues).toHaveBeenCalledTimes(3);
  });

  test("handles net loss correctly", async () => {
    setSelectResults([
      [makeBook()],
      makeClosedPeriods(12),
      [],
      // Revenue less than expenses
      [{ accountId: "rev-1", balance: "2000.0000" }],
      [{ accountId: "exp-1", balance: "5000.0000" }],
      [{ id: "re-1", bookId: "book-1" }],
      [{ id: "je-1", bookId: "book-1" }],
    ]);

    const result = await runYearEndClose({
      bookId: "book-1",
      year: 2025,
    });

    expect(result).toMatchObject({
      status: "closed",
      netIncome: -3000,
    });
  });

  test("returns blocked when book not found", async () => {
    setSelectResults([[]]);

    const result = await runYearEndClose({
      bookId: "missing",
      year: 2025,
    });

    expect(result).toEqual({
      status: "blocked",
      reason: "Book not found",
    });
  });
});
