import { compareTotal, mergeComparative } from "./comparativeMerge";
import generateProfitAndLoss from "./profitAndLoss";

import type { ComparativeRow } from "./comparativeMerge";

interface ComparativeProfitAndLossReport {
  bookId: string;
  current: { startDate: string; endDate: string };
  prior: { startDate: string; endDate: string };
  revenue: ComparativeRow[];
  expenses: ComparativeRow[];
  totals: {
    totalRevenue: ReturnType<typeof compareTotal>;
    totalExpenses: ReturnType<typeof compareTotal>;
    netIncome: ReturnType<typeof compareTotal>;
  };
  generatedAt: string;
}

/**
 * Comparative (period-over-period) Profit & Loss: runs the P&L for the current
 * and a prior period and reports each line and total with the prior value and
 * variance. A core CPA deliverable for spotting trends and anomalies
 */
const generateComparativeProfitAndLoss = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  tagIds?: string[];
}): Promise<ComparativeProfitAndLossReport> => {
  const { bookId, startDate, endDate, priorStartDate, priorEndDate, tagIds } =
    params;

  const [current, prior] = await Promise.all([
    generateProfitAndLoss({ bookId, startDate, endDate, tagIds }),
    generateProfitAndLoss({
      bookId,
      startDate: priorStartDate,
      endDate: priorEndDate,
      tagIds,
    }),
  ]);

  return {
    bookId,
    current: { startDate, endDate },
    prior: { startDate: priorStartDate, endDate: priorEndDate },
    revenue: mergeComparative(
      current.revenue,
      prior.revenue,
      (l) => l.netAmount,
    ),
    expenses: mergeComparative(
      current.expenses,
      prior.expenses,
      (l) => l.netAmount,
    ),
    totals: {
      totalRevenue: compareTotal(current.totalRevenue, prior.totalRevenue),
      totalExpenses: compareTotal(current.totalExpenses, prior.totalExpenses),
      netIncome: compareTotal(current.netIncome, prior.netIncome),
    },
    generatedAt: new Date().toISOString(),
  };
};

export default generateComparativeProfitAndLoss;
