import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { rdExpenseTable } from "lib/db/schema";

/**
 * R&D tax credit / section 174 worksheet. Summarizes captured qualified research
 * expenses (QREs) by category, applying the IRC section 41 rule that only 65% of
 * contract research counts, and splits domestic from foreign research (foreign
 * section 174 costs amortize over 15 years rather than 5). This is a CPA-facing
 * summary, not a full Form 6765 credit computation.
 */

const CONTRACT_RESEARCH_QUALIFIED_RATE = 0.65;

/** Fraction of a category's spend that counts as a qualified research expense. */
const qualifiedRate = (category: string): number =>
  category === "contract_research" ? CONTRACT_RESEARCH_QUALIFIED_RATE : 1;

type RdExpenseRow = {
  category: string;
  amount: string;
  isForeign: boolean;
};

type CategorySummary = {
  category: string;
  rawAmount: string;
  qualifiedAmount: string;
};

type ResearchSummary = {
  byCategory: CategorySummary[];
  totalQualifiedExpenses: string;
};

type RdCreditReport = {
  bookId: string;
  year: number;
  domestic: ResearchSummary;
  foreign: ResearchSummary;
  totalRawExpenses: string;
  generatedAt: string;
};

const summarizeGroup = (rows: RdExpenseRow[]): ResearchSummary => {
  const rawByCategory = new Map<string, number>();
  const qualifiedByCategory = new Map<string, number>();

  for (const { category, amount } of rows) {
    const value = Number.parseFloat(amount);
    rawByCategory.set(category, (rawByCategory.get(category) ?? 0) + value);
    qualifiedByCategory.set(
      category,
      (qualifiedByCategory.get(category) ?? 0) +
        value * qualifiedRate(category),
    );
  }

  const byCategory: CategorySummary[] = [...rawByCategory.keys()]
    .sort()
    .map((category) => ({
      category,
      rawAmount: (rawByCategory.get(category) ?? 0).toFixed(2),
      qualifiedAmount: (qualifiedByCategory.get(category) ?? 0).toFixed(2),
    }));

  const totalQualified = [...qualifiedByCategory.values()].reduce(
    (sum, value) => sum + value,
    0,
  );

  return { byCategory, totalQualifiedExpenses: totalQualified.toFixed(2) };
};

/** Pure aggregation over captured R&D expense rows. */
export const summarizeRdExpenses = (
  rows: RdExpenseRow[],
  params: { bookId: string; year: number },
): RdCreditReport => {
  const domesticRows = rows.filter((r) => !r.isForeign);
  const foreignRows = rows.filter((r) => r.isForeign);
  const totalRaw = rows.reduce(
    (sum, r) => sum + Number.parseFloat(r.amount),
    0,
  );

  return {
    bookId: params.bookId,
    year: params.year,
    domestic: summarizeGroup(domesticRows),
    foreign: summarizeGroup(foreignRows),
    totalRawExpenses: totalRaw.toFixed(2),
    generatedAt: new Date().toISOString(),
  };
};

const generateRdCredit = async (params: {
  bookId: string;
  year: number;
}): Promise<RdCreditReport> => {
  const { bookId, year } = params;
  const rows = await dbPool
    .select({
      category: rdExpenseTable.category,
      amount: rdExpenseTable.amount,
      isForeign: rdExpenseTable.isForeign,
    })
    .from(rdExpenseTable)
    .where(
      and(eq(rdExpenseTable.bookId, bookId), eq(rdExpenseTable.year, year)),
    );

  return summarizeRdExpenses(rows, { bookId, year });
};

export default generateRdCredit;
