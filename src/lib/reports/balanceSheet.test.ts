import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: generateBalanceSheet } = await import("./balanceSheet");

// Accrual scenario that balances: A (1000 cash + 300 AR) = L (200 AP) + E (1100)
const accrualRows = [
  {
    accountId: "cash",
    accountCode: "1000",
    accountName: "Cash",
    accountType: "asset",
    subType: "bank",
    parentId: null,
    debitTotal: "1000.0000",
    creditTotal: "0.0000",
  },
  {
    accountId: "ar",
    accountCode: "1100",
    accountName: "Accounts Receivable",
    accountType: "asset",
    subType: "accounts_receivable",
    parentId: null,
    debitTotal: "300.0000",
    creditTotal: "0.0000",
  },
  {
    accountId: "ap",
    accountCode: "2000",
    accountName: "Accounts Payable",
    accountType: "liability",
    subType: "accounts_payable",
    parentId: null,
    debitTotal: "0.0000",
    creditTotal: "200.0000",
  },
  {
    accountId: "equity",
    accountCode: "3000",
    accountName: "Owner Equity",
    accountType: "equity",
    subType: null,
    parentId: null,
    debitTotal: "0.0000",
    creditTotal: "1100.0000",
  },
];

describe("generateBalanceSheet", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("accrual basis includes AR/AP and balances", async () => {
    setSelectResults([accrualRows]);

    const report = await generateBalanceSheet({
      bookId: "book-1",
      asOfDate: "2026-12-31",
    });

    expect(report.basis).toBe("accrual");
    expect(report.totalAssets).toBe("1300.0000");
    expect(report.totalLiabilities).toBe("200.0000");
    expect(report.totalEquity).toBe("1100.0000");
    expect(report.isBalanced).toBe(true);
    expect(report.assets.some((a) => a.accountId === "ar")).toBe(true);
  });

  test("cash basis drops AR/AP into an equity adjustment and stays balanced", async () => {
    setSelectResults([accrualRows]);

    const report = await generateBalanceSheet({
      bookId: "book-1",
      asOfDate: "2026-12-31",
      basis: "cash",
    });

    expect(report.basis).toBe("cash");
    // AR removed from assets, AP removed from liabilities
    expect(report.assets.some((a) => a.accountId === "ar")).toBe(false);
    expect(report.totalAssets).toBe("1000.0000");
    expect(report.totalLiabilities).toBe("0.0000");

    // Reclass adjustment = AP(200) - AR(300) = -100, so equity nets to 1000
    const adjustment = report.equity.find(
      (e) => e.accountId === "cash-basis-adjustment",
    );
    expect(adjustment?.balance).toBe("-100.0000");
    expect(report.totalEquity).toBe("1000.0000");

    // The core invariant: A = L + E
    expect(report.isBalanced).toBe(true);
  });
});
