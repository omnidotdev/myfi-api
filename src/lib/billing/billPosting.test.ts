import { describe, expect, test } from "bun:test";

import { buildBillPostings } from "./billPosting";

describe("buildBillPostings", () => {
  test("folds sales tax paid into the expense debit (US treatment)", () => {
    const postings = buildBillPostings({
      apAccountId: "ap",
      lines: [
        {
          amount: 100,
          taxAmount: 8.25,
          expenseAccountId: "supplies",
          taxPayableAccountId: "tax",
        },
      ],
    });

    // Tax paid to the vendor is part of the cost: it debits the expense, not
    // the tax-payable liability (which tracks only tax collected and owed)
    expect(postings).toEqual([
      { accountId: "supplies", debit: 108.25, credit: 0 },
      { accountId: "ap", debit: 0, credit: 108.25 },
    ]);
    expect(postings.some((p) => p.accountId === "tax")).toBe(false);
  });

  test("consolidates multiple lines on the same expense account and balances", () => {
    const postings = buildBillPostings({
      apAccountId: "ap",
      lines: [
        { amount: 100, taxAmount: 0, expenseAccountId: "rent" },
        { amount: 40, taxAmount: 0, expenseAccountId: "rent" },
      ],
    });
    expect(postings.find((p) => p.accountId === "rent")).toEqual({
      accountId: "rent",
      debit: 140,
      credit: 0,
    });
    const debit = postings.reduce((s, p) => s + p.debit, 0);
    const credit = postings.reduce((s, p) => s + p.credit, 0);
    expect(debit).toBeCloseTo(credit, 4);
  });

  test("a taxed line with no tax-payable account still folds tax into expense", () => {
    const postings = buildBillPostings({
      apAccountId: "ap",
      lines: [{ amount: 100, taxAmount: 5, expenseAccountId: "supplies" }],
    });
    expect(postings.find((p) => p.accountId === "supplies")).toEqual({
      accountId: "supplies",
      debit: 105,
      credit: 0,
    });
    expect(postings.find((p) => p.accountId === "ap")).toEqual({
      accountId: "ap",
      debit: 0,
      credit: 105,
    });
  });

  test("throws on an empty bill", () => {
    expect(() => buildBillPostings({ apAccountId: "ap", lines: [] })).toThrow(
      /no lines/,
    );
  });
});
