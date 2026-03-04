import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type CategorySpending = {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  totalAmount: string;
  transactionCount: number;
  percentOfTotal: number;
};

type SpendingCategoriesResult = {
  categories: CategorySpending[];
  total: string;
  period: { startDate: string; endDate: string };
  generatedAt: string;
};

type MonthlyTotal = {
  month: string;
  total: string;
};

type SpendingTrendsResult = {
  months: MonthlyTotal[];
  generatedAt: string;
};

/**
 * Analyze spending by category (expense accounts) within a date range
 * @param params - Book ID and date range
 * @returns Spending breakdown by expense account with percentages
 */
const getSpendingByCategory = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<SpendingCategoriesResult> => {
  const { bookId, startDate, endDate } = params;

  // Query expense journal lines grouped by account
  const results = await dbPool
    .select({
      accountId: accountTable.id,
      accountName: accountTable.name,
      accountCode: accountTable.code,
      debitTotal: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
      transactionCount: sql<number>`count(distinct ${journalEntryTable.id})`,
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
        eq(accountTable.type, "expense"),
        between(journalEntryTable.date, startDate, endDate),
      ),
    )
    .groupBy(accountTable.id, accountTable.name, accountTable.code);

  // Compute net spending per category (debits - credits for expense accounts)
  const categories: (CategorySpending & { numericAmount: number })[] = [];
  let grandTotal = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);
    const net = debit - credit;

    if (net <= 0) continue;

    grandTotal += net;
    categories.push({
      accountId: row.accountId,
      accountName: row.accountName,
      accountCode: row.accountCode,
      totalAmount: net.toFixed(4),
      transactionCount: Number(row.transactionCount),
      percentOfTotal: 0,
      numericAmount: net,
    });
  }

  // Compute percentages and sort by amount descending
  const result: CategorySpending[] = categories
    .map(({ numericAmount, ...cat }) => ({
      ...cat,
      percentOfTotal:
        grandTotal > 0
          ? Math.round((numericAmount / grandTotal) * 10000) / 100
          : 0,
    }))
    .sort(
      (a, b) =>
        Number.parseFloat(b.totalAmount) - Number.parseFloat(a.totalAmount),
    );

  return {
    categories: result,
    total: grandTotal.toFixed(4),
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Get monthly spending totals for the last N months
 * @param params - Book ID and number of months to look back
 * @returns Monthly spending totals in chronological order
 */
const getSpendingTrends = async (params: {
  bookId: string;
  months: number;
}): Promise<SpendingTrendsResult> => {
  const { bookId, months } = params;

  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - months + 1,
    1,
  );

  const results = await dbPool
    .select({
      month:
        sql<string>`to_char(${journalEntryTable.date}, 'YYYY-MM')`.as("month"),
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
        eq(accountTable.type, "expense"),
        sql`${journalEntryTable.date} >= ${startDate.toISOString()}`,
      ),
    )
    .groupBy(sql`to_char(${journalEntryTable.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${journalEntryTable.date}, 'YYYY-MM')`);

  // Build complete month list (fill gaps with zero)
  const monthMap = new Map<string, string>();

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);
    const net = Math.max(debit - credit, 0);
    monthMap.set(row.month, net.toFixed(4));
  }

  const monthsList: MonthlyTotal[] = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + i,
      1,
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthsList.push({
      month: key,
      total: monthMap.get(key) ?? "0.0000",
    });
  }

  return {
    months: monthsList,
    generatedAt: new Date().toISOString(),
  };
};

export { getSpendingByCategory, getSpendingTrends };
