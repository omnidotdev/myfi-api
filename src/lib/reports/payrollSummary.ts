import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type PayrollEntry = {
  date: string;
  memo: string | null;
  grossWages: string;
  taxes: string;
  benefits: string;
  netPay: string;
};

type PayrollSummaryReport = {
  year: number;
  payrolls: PayrollEntry[];
  totals: {
    grossWages: string;
    taxes: string;
    benefits: string;
    netPay: string;
  };
};

/**
 * Generate a payroll summary report for a given book and year.
 * Aggregates journal entries from payroll_sync and payroll_import sources.
 */
const generatePayrollSummary = async (params: {
  bookId: string;
  year: number;
}): Promise<PayrollSummaryReport> => {
  const { bookId, year } = params;

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Fetch all payroll journal entries for the year
  const entries = await dbPool
    .select()
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        sql`${journalEntryTable.source} IN ('payroll_sync', 'payroll_import')`,
        between(journalEntryTable.date, startDate, endDate),
      ),
    )
    .orderBy(journalEntryTable.date);

  const payrolls: PayrollEntry[] = [];
  let totalGrossWages = 0;
  let totalTaxes = 0;
  let totalBenefits = 0;
  let totalNetPay = 0;

  for (const entry of entries) {
    // Fetch journal lines with account info
    const lines = await dbPool
      .select({
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
        accountType: accountTable.type,
        accountSubType: accountTable.subType,
      })
      .from(journalLineTable)
      .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
      .where(eq(journalLineTable.journalEntryId, entry.id));

    let grossWages = 0;
    let taxes = 0;
    let benefits = 0;
    let netPay = 0;

    for (const line of lines) {
      const debit = Number.parseFloat(line.debit ?? "0");
      const credit = Number.parseFloat(line.credit ?? "0");

      if (line.accountType === "expense") {
        // Gross wages and employer taxes are debits on expense accounts
        grossWages += debit;
      } else if (line.accountType === "liability") {
        // Taxes and benefits are credits on liability accounts
        if (
          line.accountSubType === "other_liability" ||
          line.accountSubType === "accounts_payable"
        ) {
          benefits += credit;
        } else {
          taxes += credit;
        }
      } else if (
        line.accountType === "asset" &&
        (line.accountSubType === "bank" || line.accountSubType === "cash")
      ) {
        // Net pay is credit on bank/cash accounts
        netPay += credit;
      }
    }

    payrolls.push({
      date: entry.date,
      memo: entry.memo,
      grossWages: grossWages.toFixed(2),
      taxes: taxes.toFixed(2),
      benefits: benefits.toFixed(2),
      netPay: netPay.toFixed(2),
    });

    totalGrossWages += grossWages;
    totalTaxes += taxes;
    totalBenefits += benefits;
    totalNetPay += netPay;
  }

  return {
    year,
    payrolls,
    totals: {
      grossWages: totalGrossWages.toFixed(2),
      taxes: totalTaxes.toFixed(2),
      benefits: totalBenefits.toFixed(2),
      netPay: totalNetPay.toFixed(2),
    },
  };
};

export default generatePayrollSummary;
