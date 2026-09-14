import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { inferAccountType, createAccountsForUnmatched } = await import(
  "./createMigrationAccounts"
);

describe("inferAccountType", () => {
  test("maps standard account-number ranges to types", () => {
    expect(inferAccountType("1010", "Checking", 100, 0)).toBe("asset");
    expect(inferAccountType("2100", "Credit Card", 0, 100)).toBe("liability");
    expect(inferAccountType("3000", "Common Stock", 0, 100)).toBe("equity");
    expect(inferAccountType("4000", "Sales", 0, 100)).toBe("revenue");
    expect(inferAccountType("5000", "COGS", 100, 0)).toBe("expense");
    expect(inferAccountType("6010", "Salary & Wages", 100, 0)).toBe("expense");
  });

  test("classifies numberless equity accounts by name", () => {
    expect(inferAccountType(undefined, "Retained Earnings", 0, 100)).toBe(
      "equity",
    );
    expect(inferAccountType(undefined, "Owner draws", 100, 0)).toBe("equity");
    expect(inferAccountType(undefined, "Owner investments", 0, 100)).toBe(
      "equity",
    );
  });

  test("classifies numberless liability/asset accounts by name", () => {
    expect(inferAccountType(undefined, "Accounts Payable", 0, 1000)).toBe(
      "liability",
    );
    expect(inferAccountType(undefined, "Accounts Receivable", 1000, 0)).toBe(
      "asset",
    );
  });

  test("falls back to the normal balance side for other numberless accounts", () => {
    expect(inferAccountType(undefined, "Refunds to customers", 20, 0)).toBe(
      "expense",
    );
    expect(inferAccountType(undefined, "Misc Income", 0, 500)).toBe("revenue");
  });
});

describe("createAccountsForUnmatched", () => {
  beforeEach(() => resetDbMock());

  test("creates an account per unmatched row and returns opening lines", async () => {
    setInsertReturningData([{ id: "new-acct" }]);

    const lines = await createAccountsForUnmatched({
      bookId: "book-1",
      accounts: [
        { name: "Salary & Wages", accountNum: "6010", debit: 14881, credit: 0 },
        { name: "Owner draws", debit: 159714.37, credit: 0 },
      ],
    });

    expect(lines).toEqual([
      {
        accountId: "new-acct",
        debit: 14881,
        credit: 0,
        name: "Salary & Wages",
      },
      {
        accountId: "new-acct",
        debit: 159714.37,
        credit: 0,
        name: "Owner draws",
      },
    ]);
  });
});
