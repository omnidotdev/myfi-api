import { describe, expect, test } from "bun:test";

import { buildDebtPaymentLines } from "./buildDebtPaymentLines";

describe("buildDebtPaymentLines", () => {
  test("debits the liability and credits the funding account", () => {
    const lines = buildDebtPaymentLines({
      liabilityAccountId: "liab",
      creditAccountId: "checking",
      amount: 200,
    });
    expect(lines).toEqual([
      { accountId: "liab", debit: "200.0000", credit: "0.0000" },
      { accountId: "checking", debit: "0.0000", credit: "200.0000" },
    ]);
  });

  test("the entry balances", () => {
    const lines = buildDebtPaymentLines({
      liabilityAccountId: "liab",
      creditAccountId: "equity",
      amount: 99.99,
    });
    const debits = lines?.reduce((s, l) => s + Number(l.debit), 0);
    const credits = lines?.reduce((s, l) => s + Number(l.credit), 0);
    expect(debits).toBe(credits);
  });

  test("returns null for a non-positive amount", () => {
    expect(
      buildDebtPaymentLines({
        liabilityAccountId: "liab",
        creditAccountId: "checking",
        amount: 0,
      }),
    ).toBeNull();
  });
});
