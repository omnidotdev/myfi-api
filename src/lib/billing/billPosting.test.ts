import { describe, expect, test } from "bun:test";

import { buildBillPostings } from "./billPosting";

describe("buildBillPostings", () => {
  test("credits AP for the total and debits expense plus input tax", () => {
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

    expect(postings).toEqual([
      { accountId: "supplies", debit: 100, credit: 0 },
      { accountId: "tax", debit: 8.25, credit: 0 },
      { accountId: "ap", debit: 0, credit: 108.25 },
    ]);
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

  test("throws when a taxed line has no tax payable account", () => {
    expect(() =>
      buildBillPostings({
        apAccountId: "ap",
        lines: [{ amount: 100, taxAmount: 5, expenseAccountId: "supplies" }],
      }),
    ).toThrow(/tax payable account/);
  });

  test("throws on an empty bill", () => {
    expect(() => buildBillPostings({ apAccountId: "ap", lines: [] })).toThrow(
      /no lines/,
    );
  });
});
