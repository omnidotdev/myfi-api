interface Mapping {
  debitAccountId: string;
  creditAccountId: string;
}

interface PayrollLine {
  accountId: string;
  debit: string;
  credit: string;
}

/**
 * Payroll totals fields we post. Gross wages is an expense (debit); net pay and
 * the employee withholdings are credits (cash out + liabilities). Employer taxes
 * are special: they are BOTH an expense (debit) and a payroll-tax liability
 * (credit), so they post as a self-balancing pair — omitting the liability
 * credit is what left every payroll entry unbalanced.
 */
const COMPONENTS = [
  { event: "payroll_gross_wages", field: "gross_pay", kind: "debit" },
  { event: "payroll_employer_tax", field: "employer_taxes", kind: "pair" },
  { event: "payroll_net_pay", field: "net_pay", kind: "credit" },
  { event: "payroll_employee_tax", field: "employee_taxes", kind: "credit" },
  {
    event: "payroll_benefits",
    field: "employee_benefits_deductions",
    kind: "credit",
  },
] as const;

/**
 * Build balanced journal lines for a payroll from its totals and the book's
 * event→account mappings. Components with no amount or no mapping are skipped
 * @param totals - Payroll totals keyed by field (string amounts)
 * @param mappingsByEvent - Map of event type to its debit/credit account ids
 */
export const buildPayrollLines = (
  totals: Record<string, string | undefined>,
  mappingsByEvent: Map<string, Mapping>,
): PayrollLine[] => {
  const lines: PayrollLine[] = [];

  for (const component of COMPONENTS) {
    const amount = Number.parseFloat(totals[component.field] ?? "0");
    if (!amount) continue;

    const mapping = mappingsByEvent.get(component.event);
    if (!mapping) continue;

    const value = amount.toFixed(4);

    if (component.kind === "debit" || component.kind === "pair") {
      lines.push({
        accountId: mapping.debitAccountId,
        debit: value,
        credit: "0.0000",
      });
    }
    if (component.kind === "credit" || component.kind === "pair") {
      lines.push({
        accountId: mapping.creditAccountId,
        debit: "0.0000",
        credit: value,
      });
    }
  }

  return lines;
};
