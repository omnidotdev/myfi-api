import generateBalanceSheet from "./balanceSheet";
import { compareTotal, mergeComparative } from "./comparativeMerge";

import type { ComparativeRow } from "./comparativeMerge";

interface ComparativeBalanceSheetReport {
  bookId: string;
  asOfDate: string;
  priorAsOfDate: string;
  assets: ComparativeRow[];
  liabilities: ComparativeRow[];
  equity: ComparativeRow[];
  totals: {
    totalAssets: ReturnType<typeof compareTotal>;
    totalLiabilities: ReturnType<typeof compareTotal>;
    totalEquity: ReturnType<typeof compareTotal>;
  };
  generatedAt: string;
}

/**
 * Comparative Balance Sheet: the statement as of the current date beside a prior
 * date, with per-account and total variance. Lets a CPA see how the financial
 * position changed between two points in time
 */
const generateComparativeBalanceSheet = async (params: {
  bookId: string;
  asOfDate: string;
  priorAsOfDate: string;
  tagIds?: string[];
}): Promise<ComparativeBalanceSheetReport> => {
  const { bookId, asOfDate, priorAsOfDate, tagIds } = params;

  const [current, prior] = await Promise.all([
    generateBalanceSheet({ bookId, asOfDate, tagIds }),
    generateBalanceSheet({ bookId, asOfDate: priorAsOfDate, tagIds }),
  ]);

  return {
    bookId,
    asOfDate,
    priorAsOfDate,
    assets: mergeComparative(current.assets, prior.assets, (l) => l.balance),
    liabilities: mergeComparative(
      current.liabilities,
      prior.liabilities,
      (l) => l.balance,
    ),
    equity: mergeComparative(current.equity, prior.equity, (l) => l.balance),
    totals: {
      totalAssets: compareTotal(current.totalAssets, prior.totalAssets),
      totalLiabilities: compareTotal(
        current.totalLiabilities,
        prior.totalLiabilities,
      ),
      totalEquity: compareTotal(current.totalEquity, prior.totalEquity),
    },
    generatedAt: new Date().toISOString(),
  };
};

export default generateComparativeBalanceSheet;
