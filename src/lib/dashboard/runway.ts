import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

/** Asset sub-types that count as spendable cash for runway */
const CASH_SUB_TYPES = ["cash", "bank"] as const;

/** Months of recent burn averaged into the runway figure */
const BURN_AVERAGE_MONTHS = 3;

type MonthCashFlow = {
  month: string;
  income: string;
  expenses: string;
  net: string;
  burn: string;
};

type RunwayResult = {
  cashOnHand: string;
  months: MonthCashFlow[];
  monthlyBurn: string;
  averageBurn: string;
  /** Months of runway at the average burn; null when not burning cash */
  runwayMonths: number | null;
  asOf: string;
};

/** The YYYY-MM of `count` months ending at (and including) the current month */
const recentMonths = (count: number): string[] => {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
};

/**
 * Cash runway for a book: current cash on hand, monthly income vs expenses over
 * a recent window, the latest month's burn, the average burn over the last few
 * complete months, and runway (cash / average burn). Burn is positive when the
 * book spends more than it earns; runway is null when it is not burning cash
 */
const getRunway = async (params: {
  bookId: string;
  months?: number;
}): Promise<RunwayResult> => {
  const { bookId, months = 6 } = params;
  const window = recentMonths(months);
  const windowStart = `${window[0]}-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [cashRow] = await dbPool
    .select({
      balance: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
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
        eq(accountTable.type, "asset"),
        inArray(accountTable.subType, CASH_SUB_TYPES),
        lte(journalEntryTable.date, `${today}T23:59:59Z`),
      ),
    );

  const cashOnHand = Number.parseFloat(cashRow?.balance ?? "0");

  const flows = await dbPool
    .select({
      month: sql<string>`to_char(${journalEntryTable.date}, 'YYYY-MM')`,
      accountType: accountTable.type,
      debit: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
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
        inArray(accountTable.type, ["revenue", "expense"]),
        gte(journalEntryTable.date, `${windowStart}T00:00:00Z`),
        lte(journalEntryTable.date, `${today}T23:59:59Z`),
      ),
    )
    .groupBy(
      sql`to_char(${journalEntryTable.date}, 'YYYY-MM')`,
      accountTable.type,
    );

  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  for (const row of flows) {
    const debit = Number.parseFloat(row.debit);
    const credit = Number.parseFloat(row.credit);
    if (row.accountType === "revenue") {
      // revenue is credit-normal
      income[row.month] = (income[row.month] ?? 0) + (credit - debit);
    } else {
      // expense is debit-normal
      expenses[row.month] = (expenses[row.month] ?? 0) + (debit - credit);
    }
  }

  const monthly: MonthCashFlow[] = window.map((month) => {
    const inc = income[month] ?? 0;
    const exp = expenses[month] ?? 0;
    const net = inc - exp;
    return {
      month,
      income: inc.toFixed(4),
      expenses: exp.toFixed(4),
      net: net.toFixed(4),
      burn: (-net).toFixed(4),
    };
  });

  // Latest month's burn (the current, possibly partial, month)
  const monthlyBurn = monthly.at(-1)?.burn ?? "0.0000";

  // Average burn over the last few COMPLETE months (exclude the current month)
  const completeMonths = monthly.slice(0, -1).slice(-BURN_AVERAGE_MONTHS);
  const averageBurnNum =
    completeMonths.length > 0
      ? completeMonths.reduce((sum, m) => sum + Number.parseFloat(m.burn), 0) /
        completeMonths.length
      : 0;

  const runwayMonths =
    averageBurnNum > 0
      ? Math.round((cashOnHand / averageBurnNum) * 10) / 10
      : null;

  return {
    cashOnHand: cashOnHand.toFixed(4),
    months: monthly,
    monthlyBurn,
    averageBurn: averageBurnNum.toFixed(4),
    runwayMonths,
    asOf: today,
  };
};

export default getRunway;
