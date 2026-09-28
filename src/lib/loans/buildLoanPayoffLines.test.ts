import { describe, expect, test } from "bun:test";

import { buildLoanPayoffLines } from "./buildLoanPayoffLines";

const balances = (lines: { debit: string; credit: string }[]) => ({
  debit: lines.reduce((s, l) => s + Number(l.debit), 0),
  credit: lines.reduce((s, l) => s + Number(l.credit), 0),
});

const base = {
  liabilityAccountId: "liab",
  interestAccountId: "int",
  paymentAccountId: "cash",
  equityAccountId: "equity",
};

describe("buildLoanPayoffLines", () => {
  test("exact payoff balances", () => {
    const lines = buildLoanPayoffLines({
      ...base,
      currentBalance: 1000,
      payoffAmount: 1000,
    });
    const { debit, credit } = balances(lines ?? []);
    expect(debit).toBe(credit);
    expect(debit).toBe(1000);
  });

  test("payoff above balance books the extra as interest, balances", () => {
    const lines = buildLoanPayoffLines({
      ...base,
      currentBalance: 1000,
      payoffAmount: 1050,
    });
    const { debit, credit } = balances(lines ?? []);
    expect(debit).toBe(credit);
    expect(
      lines?.some((l) => l.accountId === "int" && l.debit === "50.0000"),
    ).toBe(true);
  });

  test("settlement below balance books forgiveness to equity, balances", () => {
    const lines = buildLoanPayoffLines({
      ...base,
      currentBalance: 1000,
      payoffAmount: 600,
    });
    const { debit, credit } = balances(lines ?? []);
    expect(debit).toBe(credit);
    expect(debit).toBe(1000);
    expect(
      lines?.some((l) => l.accountId === "equity" && l.credit === "400.0000"),
    ).toBe(true);
  });

  test("settlement with no equity account cannot balance -> null", () => {
    expect(
      buildLoanPayoffLines({
        ...base,
        equityAccountId: null,
        currentBalance: 1000,
        payoffAmount: 600,
      }),
    ).toBeNull();
  });
});
