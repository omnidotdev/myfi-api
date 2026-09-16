import { and, between, eq, inArray, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { customerTable, invoiceTable } from "lib/db/schema";

/** Invoice statuses that count as a booked sale (excludes draft and void) */
const SALE_STATUSES = ["open", "paid", "partial"] as const;

/** Common economic-nexus defaults; guidance only, verify per state */
const DEFAULT_THRESHOLD_AMOUNT = 100000;
const DEFAULT_THRESHOLD_TRANSACTIONS = 200;

const NO_STATE_LABEL = "(No state)";

type StateSales = {
  state: string;
  salesTotal: string;
  transactionCount: number;
  exceedsThreshold: boolean;
};

type SalesByStateResult = {
  year: number;
  threshold: { amount: number; transactions: number };
  states: StateSales[];
  totalSales: string;
  totalTransactions: number;
  generatedAt: string;
};

/**
 * Sales grouped by the customer's state for a year, from booked invoices
 * (open, paid, or partial). Each state carries its total sales and invoice
 * count, and is flagged when it meets the economic-nexus threshold (a
 * configurable dollar OR transaction count). Thresholds are guidance for where
 * to review sales-tax registration, not tax advice; verify each state's rules
 */
const getSalesByState = async (params: {
  bookId: string;
  year: number;
  thresholdAmount?: number;
  thresholdTransactions?: number;
}): Promise<SalesByStateResult> => {
  const { bookId, year } = params;
  const thresholdAmount = params.thresholdAmount ?? DEFAULT_THRESHOLD_AMOUNT;
  const thresholdTransactions =
    params.thresholdTransactions ?? DEFAULT_THRESHOLD_TRANSACTIONS;

  const rows = await dbPool
    .select({
      state: customerTable.state,
      salesTotal: sql<string>`coalesce(sum(${invoiceTable.total}), 0)`,
      transactionCount: sql<number>`count(${invoiceTable.id})`,
    })
    .from(invoiceTable)
    .innerJoin(customerTable, eq(invoiceTable.customerId, customerTable.id))
    .where(
      and(
        eq(invoiceTable.bookId, bookId),
        inArray(invoiceTable.status, SALE_STATUSES),
        between(invoiceTable.issueDate, `${year}-01-01`, `${year}-12-31`),
      ),
    )
    .groupBy(customerTable.state);

  let totalSales = 0;
  let totalTransactions = 0;

  const states: StateSales[] = rows
    .map((row) => {
      const sales = Number.parseFloat(row.salesTotal);
      const count = Number(row.transactionCount);
      totalSales += sales;
      totalTransactions += count;
      return {
        state: row.state?.trim() || NO_STATE_LABEL,
        salesTotal: sales.toFixed(4),
        transactionCount: count,
        exceedsThreshold:
          sales >= thresholdAmount || count >= thresholdTransactions,
      };
    })
    .sort(
      (a, b) =>
        Number.parseFloat(b.salesTotal) - Number.parseFloat(a.salesTotal),
    );

  return {
    year,
    threshold: {
      amount: thresholdAmount,
      transactions: thresholdTransactions,
    },
    states,
    totalSales: totalSales.toFixed(4),
    totalTransactions,
    generatedAt: new Date().toISOString(),
  };
};

export default getSalesByState;
