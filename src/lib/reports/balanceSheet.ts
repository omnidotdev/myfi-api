import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineProjectTable,
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

type ReportBasis = "accrual" | "cash";

type BalanceSheetReport = {
  bookId: string;
  asOfDate: string;
  basis: ReportBasis;
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
  projectIds?: string[];
  basis?: ReportBasis;
}): Promise<BalanceSheetReport> => {
  const { bookId, asOfDate, tagIds, projectIds } = params;
  const basis: ReportBasis = params.basis === "cash" ? "cash" : "accrual";

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

  if (projectIds?.length) {
    query = query.innerJoin(
      journalLineProjectTable,
      eq(journalLineProjectTable.journalLineId, journalLineTable.id),
    );
  }

  const results = await query
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        lte(journalEntryTable.date, asOfDate),
        sql`${accountTable.type} in ('asset', 'liability', 'equity', 'revenue', 'expense')`,
        tagIds?.length ? inArray(journalLineTagTable.tagId, tagIds) : undefined,
        projectIds?.length
          ? inArray(journalLineProjectTable.projectId, projectIds)
          : undefined,
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
  // On the cash basis, drop the AR/AP subledger balances (accrual artifacts) and
  // reclass them into equity so the sheet still balances: E_cash = E - AR + AP
  const cash = basis === "cash";
  let arDropped = 0;
  let apDropped = 0;
  // Revenue/expense accounts carry this year's activity until a year-end close
  // sweeps them into retained earnings. Their signed net (revenue credit-normal,
  // expense debit-normal) is current-year net income, which belongs in equity:
  // without it a mid-year sheet is off by exactly net income (A = L + E + NI).
  // Summing every revenue/expense line through asOfDate self-corrects for closed
  // prior years (the close entry already zeroed those accounts into equity)
  let currentYearEarnings = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    if (row.accountType === "revenue") {
      currentYearEarnings += credit - debit;
      continue;
    }
    if (row.accountType === "expense") {
      currentYearEarnings -= debit - credit;
      continue;
    }

    // Assets: debit-normal (debits increase, credits decrease)
    // Liabilities/Equity: credit-normal (credits increase, debits decrease)
    let balance: number;
    if (row.accountType === "asset") {
      balance = debit - credit;
    } else {
      balance = credit - debit;
    }

    if (
      cash &&
      row.accountType === "asset" &&
      row.subType === "accounts_receivable"
    ) {
      arDropped += balance;
      continue;
    }
    if (
      cash &&
      row.accountType === "liability" &&
      row.subType === "accounts_payable"
    ) {
      apDropped += balance;
      continue;
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

  // Surface current-year net income as an equity line so the sheet balances
  // before any year-end close (mirrors the "Net Income" line QuickBooks shows)
  const netIncome = Math.round(currentYearEarnings * 10000) / 10000;
  if (Math.abs(netIncome) >= 0.005) {
    equity.push({
      accountId: "current-year-earnings",
      accountCode: null,
      accountName: "Current Year Earnings",
      accountType: "equity",
      subType: null,
      parentId: null,
      balance: netIncome.toFixed(4),
    });
    totalEquity += netIncome;
  }

  // Reclass the dropped AR/AP into a single cash-basis equity adjustment
  if (cash && (arDropped !== 0 || apDropped !== 0)) {
    const adjustment = apDropped - arDropped;
    equity.push({
      accountId: "cash-basis-adjustment",
      accountCode: null,
      accountName: "Cash Basis Adjustment",
      accountType: "equity",
      subType: null,
      parentId: null,
      balance: adjustment.toFixed(4),
    });
    totalEquity += adjustment;
  }

  // Assets = Liabilities + Equity (within floating point tolerance)
  const isBalanced =
    Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return {
    bookId,
    asOfDate,
    basis,
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
