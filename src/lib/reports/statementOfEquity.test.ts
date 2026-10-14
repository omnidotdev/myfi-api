import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));
// Net income comes from the P&L; stub it so the rollforward math is isolated
mock.module("./profitAndLoss", () => ({
  default: async () => ({ netIncome: "400.0000" }),
}));

const { default: generateStatementOfEquity } = await import(
  "./statementOfEquity"
);

describe("generateStatementOfEquity", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("rolls current-period net income into ending equity", async () => {
    setSelectResults([
      // beginning balances (before the period): owner equity 1000 credit
      [{ accountId: "owner", debit: "0", credit: "1000" }],
      // period activity: owner contributed another 200
      [
        {
          accountId: "owner",
          accountCode: "3000",
          accountName: "Owner Equity",
          subType: null,
          debit: "0",
          credit: "200",
        },
      ],
      // all equity accounts for the book
      [
        {
          accountId: "owner",
          accountCode: "3000",
          accountName: "Owner Equity",
          subType: null,
        },
      ],
    ]);

    const report = await generateStatementOfEquity({
      bookId: "book-1",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });

    expect(report.totalBeginningEquity).toBe("1000.00");
    expect(report.netIncome).toBe("400.0000");
    // Equity accounts alone net to 1200; ending equity must also include the
    // 400 of period net income (not yet closed into an equity account), so it
    // ties to the balance sheet's current-year-earnings line
    expect(report.totalEndingEquity).toBe("1600.00");
  });
});
