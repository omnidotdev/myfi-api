import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setSelectResults,
} from "lib/test/mockDb";

// Mock syncTransactions
const mockSyncTransactions = mock(() => Promise.resolve());
mock.module("lib/plaid/syncTransactions", () => ({
  default: mockSyncTransactions,
}));

// Mock saveNetWorthSnapshot
const mockSaveSnapshot = mock(() => Promise.resolve());
mock.module("lib/netWorth/netWorthService", () => ({
  saveNetWorthSnapshot: mockSaveSnapshot,
}));

// Mock postDepreciation
const mockPostDepreciation = mock(() =>
  Promise.resolve({ postedCount: 0, skippedCount: 0 }),
);
mock.module("lib/depreciation", () => ({
  postDepreciation: mockPostDepreciation,
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: runMonthlyClose } = await import("./monthlyClose");

const balancedTrialBalance = {
  totalDebits: "100.0000",
  totalCredits: "100.0000",
};
const unbalancedTrialBalance = {
  totalDebits: "100.0000",
  totalCredits: "50.0000",
};

const makeBook = (overrides: Record<string, unknown> = {}) => ({
  id: "book-1",
  name: "Personal",
  type: "personal",
  ownerId: "user-1",
  createdAt: "2025-01-01",
  ...overrides,
});

describe("runMonthlyClose", () => {
  beforeEach(() => {
    resetDbMock();
    mockSyncTransactions.mockClear();
    mockSaveSnapshot.mockClear();
    mockPostDepreciation.mockClear();
  });

  test("skips already-closed periods", async () => {
    setSelectResults([[makeBook()], [{ id: "period-1", status: "closed" }]]);

    const results = await runMonthlyClose();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("closed");
    expect(mockSyncTransactions).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("closes period when no pending items and balanced", async () => {
    setSelectResults([
      [makeBook()], // books
      [], // no existing period
      [], // no connected accounts
      [], // no pending items
      [balancedTrialBalance], // trial balance OK
    ]);

    const results = await runMonthlyClose();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("closed");
    expect(mockInsertValues).toHaveBeenCalled();
    expect(mockSaveSnapshot).toHaveBeenCalled();
  });

  test("blocks period when pending items exist", async () => {
    setSelectResults([
      [makeBook()], // books
      [], // no existing period
      [], // no connected accounts
      [{ id: "q-1" }, { id: "q-2" }], // pending items
      [balancedTrialBalance], // trial balance (still checked)
    ]);

    const results = await runMonthlyClose();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("blocked");
    expect(results[0]!.blockers?.pendingReviewCount).toBe(2);
    expect(mockInsertValues).toHaveBeenCalled();
  });

  test("blocks period when trial balance is off", async () => {
    setSelectResults([
      [makeBook()], // books
      [], // no existing period
      [], // no connected accounts
      [], // no pending items
      [unbalancedTrialBalance], // trial balance off
    ]);

    const results = await runMonthlyClose();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("blocked");
    expect(results[0]!.blockers?.trialBalanceOff).toBe(true);
  });

  test("continues processing other books when one sync fails", async () => {
    setSelectResults([
      [makeBook(), makeBook({ id: "book-2", name: "Business" })],
      // Book 1
      [], // no existing period
      [
        {
          id: "acct-1",
          bookId: "book-1",
          accessToken: "tok",
          status: "active",
          institutionName: "Bank",
        },
      ], // connected accounts
      [], // no pending items
      [balancedTrialBalance], // trial balance OK
      // Book 2
      [], // no existing period
      [], // no connected accounts
      [], // no pending items
      [balancedTrialBalance], // trial balance OK
    ]);

    mockSyncTransactions.mockRejectedValueOnce(new Error("Sync failed"));

    const results = await runMonthlyClose();

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("closed");
    expect(results[1]!.status).toBe("closed");
  });

  test("snapshots net worth on successful close", async () => {
    setSelectResults([
      [makeBook()], // books
      [], // no existing period
      [], // no connected accounts
      [], // no pending items
      [balancedTrialBalance], // trial balance OK
    ]);

    await runMonthlyClose();

    expect(mockSaveSnapshot).toHaveBeenCalledWith({ bookId: "book-1" });
  });
});
