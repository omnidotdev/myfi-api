import { and, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  netWorthSnapshotTable,
} from "lib/db/schema";

type AccountBreakdownItem = {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  subType: string | null;
  balance: string;
};

type NetWorthResult = {
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  breakdown: {
    assets: AccountBreakdownItem[];
    liabilities: AccountBreakdownItem[];
  };
  generatedAt: string;
};

/**
 * Compute current net worth by summing all account balances
 * @param params - Book ID to compute net worth for
 * @returns Net worth breakdown with assets, liabilities, and totals
 */
const computeNetWorth = async (params: {
  bookId: string;
}): Promise<NetWorthResult> => {
  const { bookId } = params;

  const results = await dbPool
    .select({
      accountId: accountTable.id,
      accountName: accountTable.name,
      accountCode: accountTable.code,
      accountType: accountTable.type,
      subType: accountTable.subType,
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
        sql`${accountTable.type} in ('asset', 'liability')`,
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.name,
      accountTable.code,
      accountTable.type,
      accountTable.subType,
    );

  const assets: AccountBreakdownItem[] = [];
  const liabilities: AccountBreakdownItem[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    // Assets are debit-normal: balance = debits - credits
    // Liabilities are credit-normal: balance = credits - debits
    const balance =
      row.accountType === "asset" ? debit - credit : credit - debit;

    const item: AccountBreakdownItem = {
      accountId: row.accountId,
      accountName: row.accountName,
      accountCode: row.accountCode,
      subType: row.subType,
      balance: balance.toFixed(4),
    };

    if (row.accountType === "asset") {
      assets.push(item);
      totalAssets += balance;
    } else {
      liabilities.push(item);
      totalLiabilities += balance;
    }
  }

  return {
    totalAssets: totalAssets.toFixed(4),
    totalLiabilities: totalLiabilities.toFixed(4),
    netWorth: (totalAssets - totalLiabilities).toFixed(4),
    breakdown: { assets, liabilities },
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Save a net worth snapshot to the database
 * @param params - Book ID to snapshot
 * @returns The computed net worth result and snapshot ID
 */
const saveNetWorthSnapshot = async (params: {
  bookId: string;
}): Promise<NetWorthResult & { snapshotId: string }> => {
  const { bookId } = params;
  const result = await computeNetWorth({ bookId });

  const [snapshot] = await dbPool
    .insert(netWorthSnapshotTable)
    .values({
      bookId,
      date: result.generatedAt,
      totalAssets: result.totalAssets,
      totalLiabilities: result.totalLiabilities,
      netWorth: result.netWorth,
      breakdown: JSON.stringify(result.breakdown),
    })
    .returning({ id: netWorthSnapshotTable.id });

  return { ...result, snapshotId: snapshot.id };
};

export { computeNetWorth, saveNetWorthSnapshot };

export default computeNetWorth;
