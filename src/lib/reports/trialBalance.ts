import { and, between, eq, inArray, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  journalLineTagTable,
} from "lib/db/schema";

type TrialBalanceLineItem = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  debitTotal: string;
  creditTotal: string;
};

type TrialBalanceReport = {
  bookId: string;
  startDate: string;
  endDate: string;
  accounts: TrialBalanceLineItem[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
  generatedAt: string;
};

/**
 * Generate a trial balance for all accounts in a period.
 * @param params - Book ID and date range
 * @returns Trial balance with per-account debit/credit totals and balance check
 */
const generateTrialBalance = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
  tagIds?: string[];
}): Promise<TrialBalanceReport> => {
  const { bookId, startDate, endDate, tagIds } = params;

  let query = dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
      accountName: accountTable.name,
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
        between(journalEntryTable.date, startDate, endDate),
        tagIds?.length ? inArray(journalLineTagTable.tagId, tagIds) : undefined,
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.code,
      accountTable.name,
      accountTable.type,
      accountTable.subType,
    )
    .orderBy(accountTable.code);

  let totalDebits = 0;
  let totalCredits = 0;

  const accounts = results.map((row) => {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);
    totalDebits += debit;
    totalCredits += credit;
    return row;
  });

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return {
    bookId,
    startDate,
    endDate,
    accounts,
    totalDebits: totalDebits.toFixed(4),
    totalCredits: totalCredits.toFixed(4),
    isBalanced,
    generatedAt: new Date().toISOString(),
  };
};

export default generateTrialBalance;
