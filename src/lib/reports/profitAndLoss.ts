import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type PnlLineItem = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  parentId: string | null;
  debitTotal: string;
  creditTotal: string;
  netAmount: string;
};

type ProfitAndLossReport = {
  bookId: string;
  startDate: string;
  endDate: string;
  revenue: PnlLineItem[];
  expenses: PnlLineItem[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
  generatedAt: string;
};

/**
 * Generate a Profit & Loss report by querying journal lines grouped by
 * account type (revenue vs expense) within a date range.
 * @param params - Book ID and date range
 * @returns Profit and loss report with revenue, expenses, and net income
 */
const generateProfitAndLoss = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<ProfitAndLossReport> => {
  const { bookId, startDate, endDate } = params;

  // Query journal lines with account info, filtered by book and date range
  const results = await dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
      accountName: accountTable.name,
      accountType: accountTable.type,
      subType: accountTable.subType,
      parentId: accountTable.parentId,
      debitTotal: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        between(journalEntryTable.date, startDate, endDate),
        sql`${accountTable.type} in ('revenue', 'expense')`,
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.code,
      accountTable.name,
      accountTable.type,
      accountTable.subType,
      accountTable.parentId,
    );

  const revenue: PnlLineItem[] = [];
  const expenses: PnlLineItem[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const row of results) {
    // Revenue: credits increase, debits decrease
    // Expense: debits increase, credits decrease
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);
    const netAmount =
      row.accountType === "revenue" ? credit - debit : debit - credit;

    const item: PnlLineItem = {
      ...row,
      netAmount: netAmount.toFixed(4),
    };

    if (row.accountType === "revenue") {
      revenue.push(item);
      totalRevenue += netAmount;
    } else {
      expenses.push(item);
      totalExpenses += netAmount;
    }
  }

  return {
    bookId,
    startDate,
    endDate,
    revenue,
    expenses,
    totalRevenue: totalRevenue.toFixed(4),
    totalExpenses: totalExpenses.toFixed(4),
    netIncome: (totalRevenue - totalExpenses).toFixed(4),
    generatedAt: new Date().toISOString(),
  };
};

export default generateProfitAndLoss;
