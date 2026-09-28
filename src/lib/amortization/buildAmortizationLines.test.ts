import { describe, expect, test } from "bun:test";

import { buildAmortizationLines } from "./buildAmortizationLines";

const sum = (
  lines: { debit: string; credit: string }[],
  k: "debit" | "credit",
) => lines.reduce((s, l) => s + Number(l[k]), 0);

describe("buildAmortizationLines", () => {
  test("balances a plain payment (no extra principal)", () => {
    const lines = buildAmortizationLines({
      interestAccountId: "int",
      liabilityAccountId: "liab",
      paymentAccountId: "cash",
      interestAmount: "50.0000",
      principalAmount: "150.0000",
      extraPrincipal: "0.0000",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(sum(lines, "credit")).toBe(200);
  });

  test("balances when extra principal is paid (the double-count bug)", () => {
    // Debits: interest 50 + principal (150 + 100 extra) = 300; credit must == 300
    const lines = buildAmortizationLines({
      interestAccountId: "int",
      liabilityAccountId: "liab",
      paymentAccountId: "cash",
      interestAmount: "50.0000",
      principalAmount: "150.0000",
      extraPrincipal: "100.0000",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(sum(lines, "credit")).toBe(300);
  });

  test("principal line includes the extra; payment credit equals total debits", () => {
    const lines = buildAmortizationLines({
      interestAccountId: "int",
      liabilityAccountId: "liab",
      paymentAccountId: "cash",
      interestAmount: "10.0000",
      principalAmount: "90.0000",
      extraPrincipal: "25.0000",
    });
    const principal = lines.find((l) => l.accountId === "liab");
    const payment = lines.find((l) => l.accountId === "cash");
    expect(principal?.debit).toBe("115.0000");
    expect(payment?.credit).toBe("125.0000");
  });
});
