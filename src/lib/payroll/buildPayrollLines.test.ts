import { describe, expect, test } from "bun:test";

import { buildPayrollLines } from "./buildPayrollLines";

const mappings = new Map([
  [
    "payroll_gross_wages",
    { debitAccountId: "wages-exp", creditAccountId: "x" },
  ],
  [
    "payroll_employer_tax",
    { debitAccountId: "ertax-exp", creditAccountId: "ertax-liab" },
  ],
  ["payroll_net_pay", { debitAccountId: "x", creditAccountId: "cash" }],
  [
    "payroll_employee_tax",
    { debitAccountId: "x", creditAccountId: "eetax-liab" },
  ],
  [
    "payroll_benefits",
    { debitAccountId: "x", creditAccountId: "benefits-liab" },
  ],
]);

const sum = (
  lines: { debit: string; credit: string }[],
  k: "debit" | "credit",
) => lines.reduce((s, l) => s + Number(l[k]), 0);

describe("buildPayrollLines", () => {
  test("balances with employer taxes (the systematic imbalance)", () => {
    const lines = buildPayrollLines(
      {
        gross_pay: "1000.00",
        employer_taxes: "100.00",
        net_pay: "750.00",
        employee_taxes: "200.00",
        employee_benefits_deductions: "50.00",
      },
      mappings,
    );
    // gross (1000) == net (750) + employee tax (200) + benefits (50)
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(sum(lines, "debit")).toBe(1100); // gross + employer taxes
  });

  test("employer taxes post a debit (expense) AND a credit (liability)", () => {
    const lines = buildPayrollLines(
      {
        gross_pay: "0",
        employer_taxes: "100.00",
        net_pay: "0",
        employee_taxes: "0",
        employee_benefits_deductions: "0",
      },
      mappings,
    );
    expect(
      lines.some((l) => l.accountId === "ertax-exp" && l.debit === "100.0000"),
    ).toBe(true);
    expect(
      lines.some(
        (l) => l.accountId === "ertax-liab" && l.credit === "100.0000",
      ),
    ).toBe(true);
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
  });

  test("skips components with no amount or no mapping", () => {
    const lines = buildPayrollLines(
      {
        gross_pay: "500.00",
        employer_taxes: "0",
        net_pay: "500.00",
        employee_taxes: "0",
        employee_benefits_deductions: "0",
      },
      new Map([
        [
          "payroll_gross_wages",
          { debitAccountId: "wages-exp", creditAccountId: "x" },
        ],
        ["payroll_net_pay", { debitAccountId: "x", creditAccountId: "cash" }],
      ]),
    );
    expect(sum(lines, "debit")).toBe(sum(lines, "credit"));
    expect(lines).toHaveLength(2);
  });
});
