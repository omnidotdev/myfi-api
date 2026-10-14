import { describe, expect, test } from "bun:test";

import { buildYearEndCloseLines } from "./buildYearEndCloseLines";

const sum = (
  lines: { debit: string; credit: string }[],
  k: "debit" | "credit",
) => lines.reduce((s, l) => s + Number(l[k]), 0);

describe("buildYearEndCloseLines", () => {
  test("balances a normal year (revenue > expenses)", () => {
    const { lines, netIncome } = buildYearEndCloseLines({
      // revenue balance is credit - debit; expense balance is debit - credit
      revenueBalances: [{ accountId: "rev", balance: "1000.0000" }],
      expenseBalances: [{ accountId: "exp", balance: "600.0000" }],
      retainedEarningsId: "re",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(netIncome).toBe(400);
  });

  test("balances with a contra-revenue account (negative revenue balance)", () => {
    // Refunds exceed sales on one revenue account -> net debit balance (-200)
    const { lines, netIncome } = buildYearEndCloseLines({
      revenueBalances: [
        { accountId: "sales", balance: "1000.0000" },
        { accountId: "refunds", balance: "-200.0000" },
      ],
      expenseBalances: [{ accountId: "exp", balance: "300.0000" }],
      retainedEarningsId: "re",
    });
    // The old abs()-with-fixed-direction code unbalanced here
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(netIncome).toBe(500); // (1000 - 200) - 300
    // The contra-revenue account is cleared with a credit, not a debit
    const refund = lines.find((l) => l.accountId === "refunds");
    expect(refund?.credit).toBe("200.0000");
  });

  test("sub-cent account balances stay balanced (no dropped lines)", () => {
    // Two revenue accounts each 0.0040: an earlier per-line 0.005 skip dropped
    // both lines while still summing them into net income, producing a
    // retained-earnings line with nothing to offset it (an unbalanced entry)
    const { lines } = buildYearEndCloseLines({
      revenueBalances: [
        { accountId: "rev1", balance: "0.0040" },
        { accountId: "rev2", balance: "0.0040" },
      ],
      expenseBalances: [],
      retainedEarningsId: "re",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    // Both revenue lines are emitted (not dropped), offset by the RE credit
    expect(lines.filter((l) => l.accountId.startsWith("rev"))).toHaveLength(2);
    const re = lines.find((l) => l.accountId === "re");
    expect(re?.credit).toBe("0.0080");
  });

  test("an exactly-zero balance is skipped", () => {
    const { lines } = buildYearEndCloseLines({
      revenueBalances: [
        { accountId: "rev", balance: "500.0000" },
        { accountId: "empty", balance: "0.0000" },
      ],
      expenseBalances: [],
      retainedEarningsId: "re",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(lines.some((l) => l.accountId === "empty")).toBe(false);
  });

  test("balances a net loss (credits retained earnings via a debit)", () => {
    const { lines, netIncome } = buildYearEndCloseLines({
      revenueBalances: [{ accountId: "rev", balance: "400.0000" }],
      expenseBalances: [{ accountId: "exp", balance: "700.0000" }],
      retainedEarningsId: "re",
    });
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(netIncome).toBe(-300);
    const re = lines.find((l) => l.accountId === "re");
    expect(re?.debit).toBe("300.0000");
  });
});
