import { and, asc, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { entryDateBefore, entryDateBetween } from "./entryDateFilters";
import { lineHasAnyProject, lineHasAnyTag } from "./journalLineFilters";

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
  projectIds?: string[],
): Promise<number> => {
  const query = dbPool
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

  // Subquery membership test instead of a tag/project join, so a line matching
  // multiple tags is not fanned out and double-summed into the opening balance
  const [result] = await query.where(
    and(
      eq(journalEntryTable.bookId, bookId),
      eq(journalLineTable.accountId, accountId),
      entryDateBefore(beforeDate),
      tagIds?.length ? lineHasAnyTag(tagIds) : undefined,
      projectIds?.length ? lineHasAnyProject(projectIds) : undefined,
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
  projectIds?: string[];
}): Promise<GeneralLedgerReport> => {
  const { bookId, accountId, startDate, endDate, tagIds, projectIds } = params;

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
    projectIds,
  );

  // Fetch journal lines within the date range for this account
  const entriesQuery = dbPool
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

  // Subquery membership test instead of a tag/project join, so a line matching
  // multiple tags is not duplicated into multiple ledger rows (which would also
  // inflate the running balance and the debit/credit totals)
  const results = await entriesQuery
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalLineTable.accountId, accountId),
        entryDateBetween(startDate, endDate),
        tagIds?.length ? lineHasAnyTag(tagIds) : undefined,
        projectIds?.length ? lineHasAnyProject(projectIds) : undefined,
      ),
    )
    // Stable tiebreaker so the running balance is deterministic within a day
    .orderBy(asc(journalEntryTable.date), asc(journalEntryTable.createdAt));

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
