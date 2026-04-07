import { and, asc, between, eq, inArray, lt, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  journalLineTagTable,
} from "lib/db/schema";

type GeneralLedgerEntry = {
  date: string;
  memo: string | null;
  source: string;
  debit: string;
  credit: string;
  runningBalance: string;
};

type GeneralLedgerReport = {
  bookId: string;
  accountId: string;
  accountName: string;
  accountCode: string | null;
  startDate: string;
  endDate: string;
  entries: GeneralLedgerEntry[];
  openingBalance: string;
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  generatedAt: string;
};

/**
 * Compute the opening balance for an account before a given date.
 * Assets/expenses are debit-normal, liabilities/equity/revenue are credit-normal
 */
const computeOpeningBalance = async (
  bookId: string,
  accountId: string,
  accountType: string,
  beforeDate: string,
  tagIds?: string[],
): Promise<number> => {
  let query = dbPool
    .select({
      debitTotal: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .$dynamic();

  if (tagIds?.length) {
    query = query.innerJoin(
      journalLineTagTable,
      eq(journalLineTagTable.journalLineId, journalLineTable.id),
    );
  }

  const [result] = await query.where(
    and(
      eq(journalEntryTable.bookId, bookId),
      eq(journalLineTable.accountId, accountId),
      lt(journalEntryTable.date, beforeDate),
      tagIds?.length ? inArray(journalLineTagTable.tagId, tagIds) : undefined,
    ),
  );

  if (!result) return 0;

  const debit = Number.parseFloat(result.debitTotal);
  const credit = Number.parseFloat(result.creditTotal);

  // Debit-normal accounts: balance = debits - credits
  // Credit-normal accounts: balance = credits - debits
  const isDebitNormal = accountType === "asset" || accountType === "expense";
  return isDebitNormal ? debit - credit : credit - debit;
};

/**
 * Generate a general ledger report for a specific account.
 * Shows full transaction history with running balance
 * @param params - Book ID, account ID, and date range
 * @returns General ledger with entries and running balance
 */
const generateGeneralLedger = async (params: {
  bookId: string;
  accountId: string;
  startDate: string;
  endDate: string;
  tagIds?: string[];
}): Promise<GeneralLedgerReport> => {
  const { bookId, accountId, startDate, endDate, tagIds } = params;

  // Fetch the account details
  const [account] = await dbPool
    .select({
      name: accountTable.name,
      code: accountTable.code,
      type: accountTable.type,
    })
    .from(accountTable)
    .where(
      and(eq(accountTable.id, accountId), eq(accountTable.bookId, bookId)),
    );

  if (!account) {
    return {
      bookId,
      accountId,
      accountName: "Unknown",
      accountCode: null,
      startDate,
      endDate,
      entries: [],
      openingBalance: "0.0000",
      closingBalance: "0.0000",
      totalDebits: "0.0000",
      totalCredits: "0.0000",
      generatedAt: new Date().toISOString(),
    };
  }

  // Compute opening balance (all entries before start date)
  const openingBalance = await computeOpeningBalance(
    bookId,
    accountId,
    account.type,
    startDate,
    tagIds,
  );

  // Fetch journal lines within the date range for this account
  let entriesQuery = dbPool
    .select({
      date: journalEntryTable.date,
      entryMemo: journalEntryTable.memo,
      lineMemo: journalLineTable.memo,
      source: journalEntryTable.source,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .$dynamic();

  if (tagIds?.length) {
    entriesQuery = entriesQuery.innerJoin(
      journalLineTagTable,
      eq(journalLineTagTable.journalLineId, journalLineTable.id),
    );
  }

  const results = await entriesQuery
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalLineTable.accountId, accountId),
        between(journalEntryTable.date, startDate, endDate),
        tagIds?.length ? inArray(journalLineTagTable.tagId, tagIds) : undefined,
      ),
    )
    .orderBy(asc(journalEntryTable.date));

  const isDebitNormal = account.type === "asset" || account.type === "expense";
  let runningBalance = openingBalance;
  let totalDebits = 0;
  let totalCredits = 0;

  const entries: GeneralLedgerEntry[] = results.map((row) => {
    const debit = Number.parseFloat(row.debit);
    const credit = Number.parseFloat(row.credit);

    totalDebits += debit;
    totalCredits += credit;

    // Update running balance based on account normal balance
    if (isDebitNormal) {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }

    return {
      date: row.date,
      memo: row.lineMemo ?? row.entryMemo,
      source: row.source,
      debit: debit.toFixed(4),
      credit: credit.toFixed(4),
      runningBalance: runningBalance.toFixed(4),
    };
  });

  return {
    bookId,
    accountId,
    accountName: account.name,
    accountCode: account.code,
    startDate,
    endDate,
    entries,
    openingBalance: openingBalance.toFixed(4),
    closingBalance: runningBalance.toFixed(4),
    totalDebits: totalDebits.toFixed(4),
    totalCredits: totalCredits.toFixed(4),
    generatedAt: new Date().toISOString(),
  };
};

export default generateGeneralLedger;
