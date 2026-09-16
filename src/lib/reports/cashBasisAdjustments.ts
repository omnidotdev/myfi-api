import { and, between, eq, gt, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  billLineTable,
  billPaymentTable,
  billTable,
  invoiceLineTable,
  invoicePaymentTable,
  invoiceTable,
} from "lib/db/schema";

/**
 * Cash-basis recognition of invoiced revenue: for each invoice payment in the
 * range, the revenue portion (payment amount x line amount / invoice total,
 * which excludes tax since total includes it) is attributed to each income
 * account on the invoice, at the payment date. Returns a map of income account
 * id to collected revenue
 */
export const collectedRevenueByAccount = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<Map<string, number>> => {
  const { bookId, startDate, endDate } = params;

  const rows = await dbPool
    .select({
      accountId: invoiceLineTable.incomeAccountId,
      amount: sql<string>`coalesce(sum(${invoicePaymentTable.amount} * ${invoiceLineTable.amount} / ${invoiceTable.total}), 0)`,
    })
    .from(invoicePaymentTable)
    .innerJoin(invoiceTable, eq(invoicePaymentTable.invoiceId, invoiceTable.id))
    .innerJoin(
      invoiceLineTable,
      eq(invoiceLineTable.invoiceId, invoiceTable.id),
    )
    .where(
      and(
        eq(invoiceTable.bookId, bookId),
        gt(invoiceTable.total, "0"),
        between(invoicePaymentTable.date, startDate, endDate),
      ),
    )
    .groupBy(invoiceLineTable.incomeAccountId);

  return new Map(rows.map((r) => [r.accountId, Number.parseFloat(r.amount)]));
};

/**
 * Cash-basis recognition of bill expenses: for each bill payment in the range,
 * the expense portion (payment amount x line amount / bill total) is attributed
 * to each expense account on the bill, at the payment date. Returns a map of
 * expense account id to paid expense
 */
export const paidExpensesByAccount = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<Map<string, number>> => {
  const { bookId, startDate, endDate } = params;

  const rows = await dbPool
    .select({
      accountId: billLineTable.expenseAccountId,
      amount: sql<string>`coalesce(sum(${billPaymentTable.amount} * ${billLineTable.amount} / ${billTable.total}), 0)`,
    })
    .from(billPaymentTable)
    .innerJoin(billTable, eq(billPaymentTable.billId, billTable.id))
    .innerJoin(billLineTable, eq(billLineTable.billId, billTable.id))
    .where(
      and(
        eq(billTable.bookId, bookId),
        gt(billTable.total, "0"),
        between(billPaymentTable.date, startDate, endDate),
      ),
    )
    .groupBy(billLineTable.expenseAccountId);

  return new Map(rows.map((r) => [r.accountId, Number.parseFloat(r.amount)]));
};
