import { and, between, eq, inArray, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineProjectTable,
  journalLineTable,
  journalLineTagTable,
} from "lib/db/schema";
import {
  collectedRevenueByAccount,
  paidExpensesByAccount,
} from "./cashBasisAdjustments";

type ReportBasis = "accrual" | "cash";

type PnlLineItem = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  parentId: string | null;
  debitTotal: string;
  creditTotal: string;
  netAmount: string;
};

type ProfitAndLossReport = {
  bookId: string;
  startDate: string;
  endDate: string;
  basis: ReportBasis;
  revenue: PnlLineItem[];
  expenses: PnlLineItem[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
  generatedAt: string;
};

type AccountMeta = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  parentId: string | null;
};

/** Fetch metadata for accounts that appear only in the cash-basis adjustments */
const fetchAccountMeta = async (
  accountIds: string[],
): Promise<Map<string, AccountMeta>> => {
  if (accountIds.length === 0) return new Map();
  const rows = await dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
      accountName: accountTable.name,
      accountType: accountTable.type,
      subType: accountTable.subType,
      parentId: accountTable.parentId,
    })
    .from(accountTable)
    .where(inArray(accountTable.id, accountIds));
  return new Map(rows.map((r) => [r.accountId, r]));
};

/**
 * Generate a Profit & Loss report by querying journal lines grouped by account
 * type (revenue vs expense) within a date range.
 *
 * On the accrual basis (default) revenue and expenses are recognized when
 * posted. On the cash basis, invoice and bill accruals are excluded and instead
 * recognized when their payments land: direct (bank-posted) income and expenses
 * stay at their posted date, invoiced revenue is recognized as invoices are
 * paid, and bill expenses as bills are paid. Tag filtering applies to the
 * accrual basis only.
 */
const generateProfitAndLoss = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
  tagIds?: string[];
  projectIds?: string[];
  basis?: ReportBasis;
}): Promise<ProfitAndLossReport> => {
  const { bookId, startDate, endDate, tagIds, projectIds } = params;
  const basis: ReportBasis = params.basis === "cash" ? "cash" : "accrual";
  const cash = basis === "cash";

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

  // Tag filtering is only meaningful on the accrual basis
  if (!cash && tagIds?.length) {
    query = query.innerJoin(
      journalLineTagTable,
      eq(journalLineTagTable.journalLineId, journalLineTable.id),
    );
  }

  // Project filtering is likewise accrual-only (cash-basis adjustments are
  // payment-traced and carry no project assignment)
  if (!cash && projectIds?.length) {
    query = query.innerJoin(
      journalLineProjectTable,
      eq(journalLineProjectTable.journalLineId, journalLineTable.id),
    );
  }

  const results = await query
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        between(journalEntryTable.date, startDate, endDate),
        sql`${accountTable.type} in ('revenue', 'expense')`,
        // On cash basis, drop the invoice/bill accrual recognitions; their
        // amounts come back in through the payment-traced adjustments below
        cash
          ? sql`${journalEntryTable.source} not in ('invoice', 'bill')`
          : undefined,
        !cash && tagIds?.length
          ? inArray(journalLineTagTable.tagId, tagIds)
          : undefined,
        !cash && projectIds?.length
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

  // Per-account net; revenue is credit-normal, expense is debit-normal
  const byAccount = new Map<
    string,
    { meta: AccountMeta; net: number; debit: number; credit: number }
  >();

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);
    const net = row.accountType === "revenue" ? credit - debit : debit - credit;
    byAccount.set(row.accountId, { meta: row, net, debit, credit });
  }

  if (cash) {
    const [collected, paid] = await Promise.all([
      collectedRevenueByAccount({ bookId, startDate, endDate }),
      paidExpensesByAccount({ bookId, startDate, endDate }),
    ]);

    // Any account that appears only in the adjustments needs its metadata
    const missing = [...collected.keys(), ...paid.keys()].filter(
      (id) => !byAccount.has(id),
    );
    const meta = await fetchAccountMeta(missing);

    const applyAdjustment = (
      accountId: string,
      amount: number,
      isRevenue: boolean,
    ) => {
      const existing = byAccount.get(accountId);
      if (existing) {
        existing.net += amount;
        return;
      }
      const m = meta.get(accountId);
      if (!m) return;
      byAccount.set(accountId, {
        meta: m,
        net: amount,
        debit: isRevenue ? 0 : amount,
        credit: isRevenue ? amount : 0,
      });
    };

    for (const [accountId, amount] of collected)
      applyAdjustment(accountId, amount, true);
    for (const [accountId, amount] of paid)
      applyAdjustment(accountId, amount, false);
  }

  const revenue: PnlLineItem[] = [];
  const expenses: PnlLineItem[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const { meta, net, debit, credit } of byAccount.values()) {
    const item: PnlLineItem = {
      accountId: meta.accountId,
      accountCode: meta.accountCode,
      accountName: meta.accountName,
      accountType: meta.accountType,
      subType: meta.subType,
      parentId: meta.parentId,
      debitTotal: debit.toFixed(4),
      creditTotal: credit.toFixed(4),
      netAmount: net.toFixed(4),
    };

    if (meta.accountType === "revenue") {
      revenue.push(item);
      totalRevenue += net;
    } else {
      expenses.push(item);
      totalExpenses += net;
    }
  }

  return {
    bookId,
    startDate,
    endDate,
    basis,
    revenue,
    expenses,
    totalRevenue: totalRevenue.toFixed(4),
    totalExpenses: totalExpenses.toFixed(4),
    netIncome: (totalRevenue - totalExpenses).toFixed(4),
    generatedAt: new Date().toISOString(),
  };
};

export default generateProfitAndLoss;
