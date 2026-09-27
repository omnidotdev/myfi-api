import { describe, expect, test } from "bun:test";

import { buildDebtOpeningLines } from "./buildDebtOpeningLines";

describe("buildDebtOpeningLines", () => {
  test("credits the liability and debits the offset for the amount owed", () => {
    const lines = buildDebtOpeningLines({
      liabilityAccountId: "liab",
      offsetAccountId: "equity",
      amount: 500,
    });
    expect(lines).toEqual([
      { accountId: "liab", debit: "0.0000", credit: "500.0000" },
      { accountId: "equity", debit: "500.0000", credit: "0.0000" },
    ]);
  });

  test("the entry balances (total debits == total credits)", () => {
    const lines = buildDebtOpeningLines({
      liabilityAccountId: "liab",
      offsetAccountId: "equity",
      amount: 1234.56,
    });
    const debits = lines?.reduce((s, l) => s + Number(l.debit), 0);
    const credits = lines?.reduce((s, l) => s + Number(l.credit), 0);
    expect(debits).toBe(credits);
  });

  test("formats to 4 decimal places", () => {
    const lines = buildDebtOpeningLines({
      liabilityAccountId: "liab",
      offsetAccountId: "equity",
      amount: 100,
    });
    expect(lines?.[0].credit).toBe("100.0000");
  });

  test("returns null when there is no positive amount to record", () => {
    expect(
      buildDebtOpeningLines({
        liabilityAccountId: "liab",
        offsetAccountId: "equity",
        amount: 0,
      }),
    ).toBeNull();
    expect(
      buildDebtOpeningLines({
        liabilityAccountId: "liab",
        offsetAccountId: "equity",
        amount: -5,
      }),
    ).toBeNull();
  });
});
