import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  journalLineTagTable,
} from "lib/db/schema";

type BalanceSheetLineItem = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  parentId: string | null;
  balance: string;
};

type BalanceSheetReport = {
  bookId: string;
  asOfDate: string;
  assets: BalanceSheetLineItem[];
  liabilities: BalanceSheetLineItem[];
  equity: BalanceSheetLineItem[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  isBalanced: boolean;
  generatedAt: string;
};

/**
 * Generate a balance sheet at a point in time.
 * @param params - Book ID and as-of date
 * @returns Balance sheet with assets, liabilities, equity, and balance check
 */
const generateBalanceSheet = async (params: {
  bookId: string;
  asOfDate: string;
  tagIds?: string[];
}): Promise<BalanceSheetReport> => {
  const { bookId, asOfDate, tagIds } = params;

  let query = dbPool
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
    .$dynamic();

  if (tagIds?.length) {
    query = query.innerJoin(
      journalLineTagTable,
      eq(journalLineTagTable.journalLineId, journalLineTable.id),
    );
  }

  const results = await query
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        lte(journalEntryTable.date, asOfDate),
        sql`${accountTable.type} in ('asset', 'liability', 'equity')`,
        tagIds?.length ? inArray(journalLineTagTable.tagId, tagIds) : undefined,
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

  const assets: BalanceSheetLineItem[] = [];
  const liabilities: BalanceSheetLineItem[] = [];
  const equity: BalanceSheetLineItem[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    // Assets: debit-normal (debits increase, credits decrease)
    // Liabilities/Equity: credit-normal (credits increase, debits decrease)
    let balance: number;
    if (row.accountType === "asset") {
      balance = debit - credit;
    } else {
      balance = credit - debit;
    }

    const item: BalanceSheetLineItem = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      subType: row.subType,
      parentId: row.parentId,
      balance: balance.toFixed(4),
    };

    if (row.accountType === "asset") {
      assets.push(item);
      totalAssets += balance;
    } else if (row.accountType === "liability") {
      liabilities.push(item);
      totalLiabilities += balance;
    } else {
      equity.push(item);
      totalEquity += balance;
    }
  }

  // Assets = Liabilities + Equity (within floating point tolerance)
  const isBalanced =
    Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return {
    bookId,
    asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets: totalAssets.toFixed(4),
    totalLiabilities: totalLiabilities.toFixed(4),
    totalEquity: totalEquity.toFixed(4),
    isBalanced,
    generatedAt: new Date().toISOString(),
  };
};

export default generateBalanceSheet;
