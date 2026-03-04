import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  budgetTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type BudgetTrackingItem = {
  budgetId: string;
  accountId: string;
  accountName: string;
  accountCode: string | null;
  targetAmount: string;
  actualAmount: string;
  percentUsed: number;
  remaining: string;
  status: "on_track" | "warning" | "over_budget";
};

type BudgetTrackingResult = {
  bookId: string;
  period: string;
  startDate: string;
  endDate: string;
  budgets: BudgetTrackingItem[];
  generatedAt: string;
};

/**
 * Compute period date boundaries from a reference date and period type
 */
const computePeriodBounds = (
  period: string,
  referenceDate: Date,
): { startDate: string; endDate: string } => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  let start: Date;
  let end: Date;

  switch (period) {
    case "quarterly": {
      const quarterStart = Math.floor(month / 3) * 3;
      start = new Date(year, quarterStart, 1);
      end = new Date(year, quarterStart + 3, 0, 23, 59, 59, 999);
      break;
    }
    case "yearly": {
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      break;
    }
    // Default to monthly
    default: {
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      break;
    }
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
};

/**
 * Derive budget status from percent used
 */
const deriveStatus = (
  percentUsed: number,
): "on_track" | "warning" | "over_budget" => {
  if (percentUsed >= 100) return "over_budget";
  if (percentUsed >= 75) return "warning";
  return "on_track";
};

/**
 * Generate budget tracking data by computing actual spending against each
 * budget's target amount for the given period
 * @param params - Book ID and optional period override
 * @returns Budget tracking with actual vs target for each budget
 */
const generateBudgetTracking = async (params: {
  bookId: string;
  period?: string;
}): Promise<BudgetTrackingResult> => {
  const { bookId, period } = params;
  const now = new Date();

  // Fetch all budgets for this book with account info
  const budgets = await dbPool
    .select({
      budgetId: budgetTable.id,
      accountId: budgetTable.accountId,
      accountName: accountTable.name,
      accountCode: accountTable.code,
      targetAmount: budgetTable.amount,
      budgetPeriod: budgetTable.period,
    })
    .from(budgetTable)
    .innerJoin(accountTable, eq(budgetTable.accountId, accountTable.id))
    .where(eq(budgetTable.bookId, bookId));

  const trackingItems: BudgetTrackingItem[] = [];

  for (const budget of budgets) {
    // Use the requested period or fall back to the budget's own period
    const effectivePeriod = period ?? budget.budgetPeriod;
    const { startDate, endDate } = computePeriodBounds(effectivePeriod, now);

    // Sum debits minus credits for expense accounts within the period
    const [spending] = await dbPool
      .select({
        total: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .where(
        and(
          eq(journalLineTable.accountId, budget.accountId),
          eq(journalEntryTable.bookId, bookId),
          between(journalEntryTable.date, startDate, endDate),
        ),
      );

    const target = Number.parseFloat(budget.targetAmount);
    const actual = Math.max(Number.parseFloat(spending?.total ?? "0"), 0);
    const percentUsed = target > 0 ? (actual / target) * 100 : 0;
    const remaining = target - actual;

    trackingItems.push({
      budgetId: budget.budgetId,
      accountId: budget.accountId,
      accountName: budget.accountName,
      accountCode: budget.accountCode,
      targetAmount: target.toFixed(4),
      actualAmount: actual.toFixed(4),
      percentUsed: Math.round(percentUsed * 100) / 100,
      remaining: remaining.toFixed(4),
      status: deriveStatus(percentUsed),
    });
  }

  // Use the first budget's period for the response, or default to monthly
  const reportPeriod = period ?? budgets[0]?.budgetPeriod ?? "monthly";
  const { startDate, endDate } = computePeriodBounds(reportPeriod, now);

  return {
    bookId,
    period: reportPeriod,
    startDate,
    endDate,
    budgets: trackingItems,
    generatedAt: now.toISOString(),
  };
};

export default generateBudgetTracking;
