import { and, eq, inArray, lte } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { customerTable, invoiceTable } from "lib/db/schema";

interface AgingBuckets {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  total: string;
}

interface ArAgingCustomerRow extends AgingBuckets {
  customerId: string;
  customerName: string;
}

interface ArAgingReport {
  bookId: string;
  asOfDate: string;
  reportType: "ar";
  customers: ArAgingCustomerRow[];
  totals: AgingBuckets;
  generatedAt: string;
}

const DAY_MS = 86_400_000;

/**
 * Accounts Receivable aging from the invoice subledger: open and partially paid
 * invoices, aged by DUE date and grouped by customer, with the outstanding
 * balance (total minus amount paid) placed in the current / 1-30 / 31-60 /
 * 61-90 / over-90 bucket. This is the real AR aging a business acts on (who
 * owes what, how overdue), distinct from the ledger-balance aging used for AP
 */
const generateArAging = async (params: {
  bookId: string;
  asOfDate: string;
}): Promise<ArAgingReport> => {
  const { bookId, asOfDate } = params;
  const asOfMs = new Date(asOfDate).getTime();

  const rows = await dbPool
    .select({
      total: invoiceTable.total,
      amountPaid: invoiceTable.amountPaid,
      dueDate: invoiceTable.dueDate,
      customerId: invoiceTable.customerId,
      customerName: customerTable.name,
    })
    .from(invoiceTable)
    .innerJoin(customerTable, eq(invoiceTable.customerId, customerTable.id))
    .where(
      and(
        eq(invoiceTable.bookId, bookId),
        inArray(invoiceTable.status, ["open", "partial"]),
        lte(invoiceTable.issueDate, asOfDate),
      ),
    );

  const customerMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    }
  >();

  for (const row of rows) {
    const outstanding =
      (Number.parseFloat(row.total as string) || 0) -
      (Number.parseFloat(row.amountPaid as string) || 0);
    if (outstanding <= 0.00005) continue;

    const dueMs = new Date(row.dueDate).getTime();
    const daysOverdue = Math.floor((asOfMs - dueMs) / DAY_MS);

    let bucket = customerMap.get(row.customerId);
    if (!bucket) {
      bucket = {
        customerId: row.customerId,
        customerName: row.customerName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
      };
      customerMap.set(row.customerId, bucket);
    }

    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.days1to30 += outstanding;
    else if (daysOverdue <= 60) bucket.days31to60 += outstanding;
    else if (daysOverdue <= 90) bucket.days61to90 += outstanding;
    else bucket.over90 += outstanding;
  }

  const customers: ArAgingCustomerRow[] = [];
  const totals = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };

  for (const bucket of customerMap.values()) {
    const total =
      bucket.current +
      bucket.days1to30 +
      bucket.days31to60 +
      bucket.days61to90 +
      bucket.over90;
    if (total <= 0.00005) continue;

    customers.push({
      customerId: bucket.customerId,
      customerName: bucket.customerName,
      current: bucket.current.toFixed(4),
      days1to30: bucket.days1to30.toFixed(4),
      days31to60: bucket.days31to60.toFixed(4),
      days61to90: bucket.days61to90.toFixed(4),
      over90: bucket.over90.toFixed(4),
      total: total.toFixed(4),
    });

    totals.current += bucket.current;
    totals.days1to30 += bucket.days1to30;
    totals.days31to60 += bucket.days31to60;
    totals.days61to90 += bucket.days61to90;
    totals.over90 += bucket.over90;
  }

  const grandTotal =
    totals.current +
    totals.days1to30 +
    totals.days31to60 +
    totals.days61to90 +
    totals.over90;

  return {
    bookId,
    asOfDate,
    reportType: "ar",
    customers,
    totals: {
      current: totals.current.toFixed(4),
      days1to30: totals.days1to30.toFixed(4),
      days31to60: totals.days31to60.toFixed(4),
      days61to90: totals.days61to90.toFixed(4),
      over90: totals.over90.toFixed(4),
      total: grandTotal.toFixed(4),
    },
    generatedAt: new Date().toISOString(),
  };
};

export default generateArAging;
