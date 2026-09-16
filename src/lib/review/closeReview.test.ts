import { describe, expect, test } from "bun:test";

import {
  checkDuplicates,
  checkMissingMemos,
  checkPendingReview,
  checkSuspenseBalances,
  checkTrialBalance,
} from "./closeReview";

import type { ReviewEntry } from "./closeReview";

const entry = (o: Partial<ReviewEntry>): ReviewEntry => ({
  id: "e1",
  date: "2026-03-10",
  memo: "Office supplies",
  source: "manual",
  amount: 100,
  ...o,
});

describe("checkDuplicates", () => {
  test("flags entries sharing date, amount, and memo", () => {
    const findings = checkDuplicates([
      entry({ id: "a" }),
      entry({ id: "b" }),
      entry({ id: "c", amount: 999, memo: "Rent" }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("possible_duplicates");
    expect(findings[0]?.severity).toBe("warning");
    expect(findings[0]?.count).toBe(1);
  });

  test("skips blank-memo entries (legit identical postings)", () => {
    expect(
      checkDuplicates([
        entry({ id: "a", memo: "" }),
        entry({ id: "b", memo: null }),
      ]),
    ).toHaveLength(0);
  });

  test("no finding when all entries are distinct", () => {
    expect(
      checkDuplicates([
        entry({ id: "a", memo: "A" }),
        entry({ id: "b", memo: "B" }),
      ]),
    ).toHaveLength(0);
  });
});

describe("checkMissingMemos", () => {
  test("flags manual entries without a memo", () => {
    const findings = checkMissingMemos([
      entry({ source: "manual", memo: "" }),
      entry({ source: "manual", memo: "  " }),
      entry({ source: "manual", memo: "has memo" }),
      entry({ source: "statement_import", memo: "" }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.count).toBe(2);
    expect(findings[0]?.severity).toBe("info");
  });
});

describe("checkSuspenseBalances", () => {
  test("flags nonzero suspense/clearing/uncategorized accounts", () => {
    const findings = checkSuspenseBalances([
      { accountName: "Uncategorized Expense", balance: 50 },
      { accountName: "Payroll Clearing", balance: -25 },
      { accountName: "Cash", balance: 1000 },
      { accountName: "Suspense", balance: 0 },
    ]);
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === "warning")).toBe(true);
  });
});

describe("checkTrialBalance", () => {
  test("errors when debits != credits", () => {
    const findings = checkTrialBalance(1000, 900);
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.code).toBe("trial_balance_off");
  });

  test("passes within tolerance", () => {
    expect(checkTrialBalance(1000, 1000.004)).toHaveLength(0);
  });
});

describe("checkPendingReview", () => {
  test("errors when items pending", () => {
    expect(checkPendingReview(3)[0]?.severity).toBe("error");
  });
  test("clean when none pending", () => {
    expect(checkPendingReview(0)).toHaveLength(0);
  });
});
