import { describe, expect, test } from "bun:test";

import { parseTrialBalanceCsv } from "./parseTrialBalanceCsv";

// A representative QuickBooks Online "Trial Balance" CSV export, matching the
// real shape: a company/title/as-of preamble, a blank line, an "Account Name /
// Debit / Credit" header, account rows (thousands separators, a parenthesized
// negative, an account-number prefix, sub-accounts as "Parent:Child", and a
// zero row), a "$"-prefixed TOTAL row, then a basis/timestamp footer
const SAMPLE = `Omni LLC,,
Trial Balance,,
"As of Aug 31, 2026",,

Account Name,Debit,Credit
1010 Initiate Business Checking® (1702) - 1,"1,409.58",
2100 MasterCard (9928) - 1,,"25,000.00"
2200 Accrued Expenses:2202 Accrued Payroll,,0.00
Owner draws,"159,714.37",
Retained Earnings,,"69,555.35"
4000 Sales,,"70,285.00"
Refunds to customers,"(20.00)",
6000 Payroll & Related:6010 Salary & Wages,"14,881.00",
TOTAL,"$187,211.72","$187,211.72"



"Accrual Basis Sunday, September 13, 2026 11:03 PM GMT-05:00",,
`;

describe("parseTrialBalanceCsv", () => {
  test("extracts the as-of date from the preamble", () => {
    expect(parseTrialBalanceCsv(SAMPLE).asOf).toBe("Aug 31, 2026");
  });

  test("skips preamble, header, zero, TOTAL, and footer rows", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const names = accounts.map((a) => a.name);

    // 2202 Accrued Payroll (0.00), TOTAL, and the "Accrual Basis ..." footer out
    expect(names).not.toContain("Accrued Payroll");
    expect(names.some((n) => n.startsWith("TOTAL"))).toBe(false);
    expect(names.some((n) => n.includes("Accrual Basis"))).toBe(false);
    expect(accounts).toHaveLength(7);
  });

  test("keys off the leaf of a Parent:Child sub-account", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const salary = accounts.find((a) => a.name === "Salary & Wages");

    expect(salary).toEqual({
      name: "Salary & Wages",
      accountNum: "6010",
      debit: 14881,
      credit: 0,
    });
  });

  test("parses amounts with commas, a $ prefix on totals, and parens negatives", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    expect(
      accounts.find((a) => a.name === "MasterCard (9928) - 1")?.credit,
    ).toBe(25000);
    expect(accounts.find((a) => a.name === "Refunds to customers")?.debit).toBe(
      -20,
    );
  });

  test("splits a leading account number from the name", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const checking = accounts.find((a) => a.accountNum === "1010");

    expect(checking?.name).toBe("Initiate Business Checking® (1702) - 1");
  });

  test("leaves a numberless account without an account number", () => {
    const { accounts } = parseTrialBalanceCsv(SAMPLE);
    const draws = accounts.find((a) => a.name === "Owner draws");

    expect(draws).toEqual({
      name: "Owner draws",
      accountNum: undefined,
      debit: 159714.37,
      credit: 0,
    });
  });

  test("tolerates a leading BOM", () => {
    expect(parseTrialBalanceCsv(`﻿${SAMPLE}`).accounts).toHaveLength(7);
  });

  test("parses CRLF line endings identically to LF (real exports use CRLF)", () => {
    const crlf = SAMPLE.replace(/\n/g, "\r\n");
    expect(parseTrialBalanceCsv(crlf)).toEqual(parseTrialBalanceCsv(SAMPLE));
  });

  test("throws when Debit/Credit columns are absent (wrong report)", () => {
    expect(() =>
      parseTrialBalanceCsv("Date,Description,Amount\n1,2,3"),
    ).toThrow(/Debit and Credit/);
  });
});
