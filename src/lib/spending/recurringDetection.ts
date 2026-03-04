import { and, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { journalEntryTable, journalLineTable } from "lib/db/schema";

type DetectedSubscription = {
  memo: string;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  averageAmount: string;
  lastDate: string;
  estimatedAnnualCost: string;
  occurrences: number;
};

type RecurringDetectionResult = {
  subscriptions: DetectedSubscription[];
  totalAnnualCost: string;
  generatedAt: string;
};

/**
 * Frequency multipliers for annualization
 */
const ANNUAL_MULTIPLIERS: Record<DetectedSubscription["frequency"], number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/**
 * Detect frequency from average gap between occurrences in days
 */
const detectFrequency = (
  avgGapDays: number,
): DetectedSubscription["frequency"] => {
  if (avgGapDays <= 10) return "weekly";
  if (avgGapDays <= 21) return "biweekly";
  if (avgGapDays <= 45) return "monthly";
  if (avgGapDays <= 120) return "quarterly";
  return "yearly";
};

/**
 * Detect recurring transactions by analyzing journal entry patterns
 * grouped by memo/merchant name
 * @param params - Book ID to analyze
 * @returns Detected subscriptions with frequency and cost estimates
 */
const detectRecurringTransactions = async (params: {
  bookId: string;
}): Promise<RecurringDetectionResult> => {
  const { bookId } = params;

  // Find memo groups with multiple occurrences from Plaid imports
  // that look like recurring charges
  const results = await dbPool
    .select({
      memo: journalEntryTable.memo,
      occurrences: sql<number>`count(*)`,
      avgAmount:
        sql<string>`coalesce(avg(${journalLineTable.debit}), 0)`.as(
          "avg_amount",
        ),
      lastDate: sql<string>`max(${journalEntryTable.date})`.as("last_date"),
      // Average gap between transactions in days
      avgGapDays: sql<number>`
        case
          when count(*) > 1
          then extract(epoch from (max(${journalEntryTable.date}) - min(${journalEntryTable.date})))
            / 86400.0
            / (count(*) - 1)
          else 365
        end
      `.as("avg_gap_days"),
    })
    .from(journalEntryTable)
    .innerJoin(
      journalLineTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalEntryTable.source, "plaid_import"),
        sql`${journalEntryTable.memo} is not null`,
        sql`${journalEntryTable.memo} != ''`,
        // Only consider debit (expense) lines
        sql`${journalLineTable.debit} > 0`,
      ),
    )
    .groupBy(journalEntryTable.memo)
    .having(sql`count(*) >= 2`);

  const subscriptions: DetectedSubscription[] = [];
  let totalAnnualCost = 0;

  for (const row of results) {
    if (!row.memo) continue;

    const avgAmount = Number.parseFloat(row.avgAmount);
    if (avgAmount <= 0) continue;

    const frequency = detectFrequency(Number(row.avgGapDays));
    const multiplier = ANNUAL_MULTIPLIERS[frequency];
    const annualCost = avgAmount * multiplier;

    totalAnnualCost += annualCost;

    subscriptions.push({
      memo: row.memo,
      frequency,
      averageAmount: avgAmount.toFixed(4),
      lastDate: row.lastDate,
      estimatedAnnualCost: annualCost.toFixed(4),
      occurrences: Number(row.occurrences),
    });
  }

  // Sort by annual cost descending
  subscriptions.sort(
    (a, b) =>
      Number.parseFloat(b.estimatedAnnualCost) -
      Number.parseFloat(a.estimatedAnnualCost),
  );

  return {
    subscriptions,
    totalAnnualCost: totalAnnualCost.toFixed(4),
    generatedAt: new Date().toISOString(),
  };
};

export default detectRecurringTransactions;
