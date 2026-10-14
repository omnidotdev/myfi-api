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

  // Open-year scenario: Cash 1000 = Equity 600 + net income (Sales 500 - Rent 100 = 400).
  // Revenue/expense accounts still carry balances (no year-end close yet), so a
  // mid-year sheet must fold their net into a "Current Year Earnings" equity line.
  const openYearRows = [
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
      accountId: "equity",
      accountCode: "3000",
      accountName: "Owner Equity",
      accountType: "equity",
      subType: null,
      parentId: null,
      debitTotal: "0.0000",
      creditTotal: "600.0000",
    },
    {
      accountId: "sales",
      accountCode: "4000",
      accountName: "Sales",
      accountType: "revenue",
      subType: null,
      parentId: null,
      debitTotal: "0.0000",
      creditTotal: "500.0000",
    },
    {
      accountId: "rent",
      accountCode: "6000",
      accountName: "Rent",
      accountType: "expense",
      subType: null,
      parentId: null,
      debitTotal: "100.0000",
      creditTotal: "0.0000",
    },
  ];

  test("folds unclosed revenue/expense into a Current Year Earnings equity line", async () => {
    setSelectResults([openYearRows]);

    const report = await generateBalanceSheet({
      bookId: "book-1",
      asOfDate: "2026-06-30",
    });

    expect(report.totalAssets).toBe("1000.0000");
    expect(report.totalLiabilities).toBe("0.0000");

    // Current-year net income (500 - 100 = 400) lands in equity, not as asset/liability
    const earnings = report.equity.find(
      (e) => e.accountId === "current-year-earnings",
    );
    expect(earnings?.balance).toBe("400.0000");
    expect(report.totalEquity).toBe("1000.0000");

    // Revenue/expense accounts never appear as their own balance-sheet lines
    expect(report.equity.some((e) => e.accountId === "sales")).toBe(false);
    expect(report.assets.some((a) => a.accountId === "rent")).toBe(false);
    expect(report.liabilities.some((l) => l.accountId === "rent")).toBe(false);

    // The core invariant now holds mid-year
    expect(report.isBalanced).toBe(true);
  });

  test("a net loss reduces equity and still balances", async () => {
    // Flip: Rent 700 expense against Sales 500 -> net loss 200; Cash drops to 400
    setSelectResults([
      [
        {
          accountId: "cash",
          accountCode: "1000",
          accountName: "Cash",
          accountType: "asset",
          subType: "bank",
          parentId: null,
          debitTotal: "400.0000",
          creditTotal: "0.0000",
        },
        {
          accountId: "equity",
          accountCode: "3000",
          accountName: "Owner Equity",
          accountType: "equity",
          subType: null,
          parentId: null,
          debitTotal: "0.0000",
          creditTotal: "600.0000",
        },
        {
          accountId: "sales",
          accountCode: "4000",
          accountName: "Sales",
          accountType: "revenue",
          subType: null,
          parentId: null,
          debitTotal: "0.0000",
          creditTotal: "500.0000",
        },
        {
          accountId: "rent",
          accountCode: "6000",
          accountName: "Rent",
          accountType: "expense",
          subType: null,
          parentId: null,
          debitTotal: "700.0000",
          creditTotal: "0.0000",
        },
      ],
    ]);

    const report = await generateBalanceSheet({
      bookId: "book-1",
      asOfDate: "2026-06-30",
    });

    const earnings = report.equity.find(
      (e) => e.accountId === "current-year-earnings",
    );
    expect(earnings?.balance).toBe("-200.0000");
    expect(report.totalEquity).toBe("400.0000");
    expect(report.isBalanced).toBe(true);
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

  test("cash basis composes AR/AP reclass with open current-year earnings", async () => {
    // A fully valid ledger: invest 600, credit sale 300 + cash sale 200,
    // pay rent 100 cash, incur supplies bill 200 (AP). Accrual A=1000, L=200,
    // Eq=600, net income=200. Cash basis must drop AR/AP AND surface earnings,
    // and the two equity adjustments must compose to keep A=L+E.
    setSelectResults([
      [
        {
          accountId: "cash",
          accountCode: "1000",
          accountName: "Cash",
          accountType: "asset",
          subType: "bank",
          parentId: null,
          debitTotal: "800.0000", // 600 invest + 200 cash sale
          creditTotal: "100.0000", // 100 rent
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
          creditTotal: "600.0000",
        },
        {
          accountId: "sales",
          accountCode: "4000",
          accountName: "Sales",
          accountType: "revenue",
          subType: null,
          parentId: null,
          debitTotal: "0.0000",
          creditTotal: "500.0000", // 300 credit + 200 cash
        },
        {
          accountId: "rent",
          accountCode: "6000",
          accountName: "Rent",
          accountType: "expense",
          subType: null,
          parentId: null,
          debitTotal: "100.0000",
          creditTotal: "0.0000",
        },
        {
          accountId: "supplies",
          accountCode: "6100",
          accountName: "Supplies",
          accountType: "expense",
          subType: null,
          parentId: null,
          debitTotal: "200.0000",
          creditTotal: "0.0000",
        },
      ],
    ]);

    const report = await generateBalanceSheet({
      bookId: "book-1",
      asOfDate: "2026-06-30",
      basis: "cash",
    });

    // Cash only (AR dropped), no liabilities (AP dropped)
    expect(report.totalAssets).toBe("700.0000");
    expect(report.totalLiabilities).toBe("0.0000");

    // Net income 200 surfaced, AR/AP reclass -100, owner equity 600 -> 700
    const earnings = report.equity.find(
      (e) => e.accountId === "current-year-earnings",
    );
    expect(earnings?.balance).toBe("200.0000");
    const adjustment = report.equity.find(
      (e) => e.accountId === "cash-basis-adjustment",
    );
    expect(adjustment?.balance).toBe("-100.0000");
    expect(report.totalEquity).toBe("700.0000");

    expect(report.isBalanced).toBe(true);
  });
});
