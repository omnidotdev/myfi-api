import { and, eq, lt, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import generateProfitAndLoss from "./profitAndLoss";

interface EquityAccountRow {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  subType: string | null;
  beginningBalance: string;
  debits: string;
  credits: string;
  endingBalance: string;
}

interface StatementOfEquityReport {
  bookId: string;
  startDate: string;
  endDate: string;
  accounts: EquityAccountRow[];
  totalBeginningEquity: string;
  totalEndingEquity: string;
  /** Net income for the period; closed to retained earnings at year-end */
  netIncome: string;
  generatedAt: string;
}

// Equity accounts carry a normal credit balance
const equityBalance = (debit: number, credit: number) => credit - debit;

/**
 * Statement of changes in equity: a rollforward of each equity account from its
 * beginning balance (before the period) through the period's debits and credits
 * to its ending balance, with the period's net income shown as a separate line
 * (it is closed to retained earnings at year-end, so it is reported rather than
 * folded into the account balances to avoid double counting)
 */
const generateStatementOfEquity = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<StatementOfEquityReport> => {
  const { bookId, startDate, endDate } = params;

  // Beginning balances: all equity activity strictly before the period
  const beginningRows = await dbPool
    .select({
      accountId: accountTable.id,
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
        eq(accountTable.type, "equity"),
        lt(journalEntryTable.date, startDate),
      ),
    )
    .groupBy(accountTable.id);
  const beginningById = new Map(
    beginningRows.map((r) => [
      r.accountId,
      equityBalance(Number(r.debit), Number(r.credit)),
    ]),
  );

  // Period activity, grouped by account with metadata
  const periodRows = await dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
      accountName: accountTable.name,
      subType: accountTable.subType,
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
        eq(accountTable.type, "equity"),
        sql`${journalEntryTable.date} between ${startDate} and ${endDate}`,
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.code,
      accountTable.name,
      accountTable.subType,
    );

  // All equity accounts for the book, so accounts with only a beginning balance
  // (no period activity) still appear
  const allEquityAccounts = await dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
      accountName: accountTable.name,
      subType: accountTable.subType,
    })
    .from(accountTable)
    .where(
      and(eq(accountTable.bookId, bookId), eq(accountTable.type, "equity")),
    );
  const periodById = new Map(periodRows.map((r) => [r.accountId, r]));

  const accounts: EquityAccountRow[] = [];
  let totalBeginning = 0;
  let totalEnding = 0;
  for (const acct of allEquityAccounts) {
    const beginning = beginningById.get(acct.accountId) ?? 0;
    const period = periodById.get(acct.accountId);
    const debits = Number(period?.debit ?? 0);
    const credits = Number(period?.credit ?? 0);
    const ending = beginning + equityBalance(debits, credits);

    // skip accounts that are entirely empty across all time
    if (beginning === 0 && debits === 0 && credits === 0) continue;

    accounts.push({
      accountId: acct.accountId,
      accountCode: acct.accountCode,
      accountName: acct.accountName,
      subType: acct.subType,
      beginningBalance: beginning.toFixed(2),
      debits: debits.toFixed(2),
      credits: credits.toFixed(2),
      endingBalance: ending.toFixed(2),
    });
    totalBeginning += beginning;
    totalEnding += ending;
  }

  const pnl = await generateProfitAndLoss({ bookId, startDate, endDate });

  return {
    bookId,
    startDate,
    endDate,
    accounts,
    totalBeginningEquity: totalBeginning.toFixed(2),
    totalEndingEquity: totalEnding.toFixed(2),
    netIncome: pnl.netIncome,
    generatedAt: new Date().toISOString(),
  };
};

export default generateStatementOfEquity;
