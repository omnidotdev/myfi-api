import { describe, expect, test } from "bun:test";

import { parseTrialBalanceCsv } from "./parseTrialBalanceCsv";

// A representative QuickBooks Online "Trial Balance" CSV export: a company /
// title / as-of preamble, a Debit/Credit header, account rows (with thousands
// separators, a parenthesized negative, an account-number prefix, and a zero
// row), and a trailing TOTAL row
const SAMPLE = `Omni LLC
Trial Balance
As of August 31, 2026
,Debit,Credit
1000 Checking,"12,500.00",
Accounts Receivable,"3,200.00",
Undeposited Funds,0.00,0.00
Accounts Payable,,"1,700.00"
Opening Balance Equity,,"14,000.00"
Sales,,"25,000.00"
Sales Returns,"(500.00)",
Rent Expense,"4,800.00",
Office Supplies,"200.00",
TOTAL,"20,700.00","40,700.00"
`;

describe("parseTrialBalanceCsv", () => {
  test("extracts the as-of date from the preamble", () => {
    expect(parseTrialBalanceCsv(SAMPLE).asOf).toBe("August 31, 2026");
  });

  test("skips preamble, header, TOTAL, and zero rows", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const names = accounts.map((a) => a.name);

    // Undeposited Funds (0/0) and TOTAL are excluded
    expect(names).not.toContain("Undeposited Funds");
    expect(names).not.toContain("TOTAL");
    expect(accounts).toHaveLength(8);
  });

  test("parses debit and credit amounts, stripping commas", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const ap = accounts.find((a) => a.name === "Accounts Payable");

    expect(ap).toEqual({
      name: "Accounts Payable",
      accountNum: undefined,
      debit: 0,
      credit: 1700,
    });
  });

  test("reads a parenthesized amount as negative", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const returns = accounts.find((a) => a.name === "Sales Returns");

    expect(returns?.debit).toBe(-500);
  });

  test("splits a leading account number from the name", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const checking = accounts.find((a) => a.name === "Checking");

    expect(checking).toEqual({
      name: "Checking",
      accountNum: "1000",
      debit: 12500,
      credit: 0,
    });
  });

  test("tolerates a leading BOM", () => {
    expect(() => parseTrialBalanceCsv(`﻿${SAMPLE}`)).not.toThrow();
    expect(parseTrialBalanceCsv(`﻿${SAMPLE}`).accounts.length).toBe(8);
  });

  test("throws when Debit/Credit columns are absent (wrong report)", () => {
    expect(() =>
      parseTrialBalanceCsv("Date,Description,Amount\n1,2,3"),
    ).toThrow(/Debit and Credit/);
  });
});
