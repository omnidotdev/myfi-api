import { and, eq, inArray, lte } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { billTable, vendorTable } from "lib/db/schema";

interface AgingBuckets {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  total: string;
}

interface ApAgingVendorRow extends AgingBuckets {
  vendorId: string;
  vendorName: string;
}

interface ApAgingReport {
  bookId: string;
  asOfDate: string;
  reportType: "ap";
  vendors: ApAgingVendorRow[];
  totals: AgingBuckets;
  generatedAt: string;
}

const DAY_MS = 86_400_000;

/**
 * Accounts Payable aging from the bill subledger: open and partially paid bills,
 * aged by DUE date and grouped by vendor, with the outstanding balance (total
 * minus amount paid) placed in the current / 1-30 / 31-60 / 61-90 / over-90
 * bucket. This is the AP aging a bookkeeper acts on (who is owed what, how
 * overdue), mirroring {@link generateArAging}. It supersedes the former
 * ledger-balance aging that bucketed AP by posting date and so ignored due
 * dates entirely
 */
const generateApAging = async (params: {
  bookId: string;
  asOfDate: string;
}): Promise<ApAgingReport> => {
  const { bookId, asOfDate } = params;
  const asOfMs = new Date(asOfDate).getTime();

  const rows = await dbPool
    .select({
      total: billTable.total,
      amountPaid: billTable.amountPaid,
      dueDate: billTable.dueDate,
      vendorId: billTable.vendorId,
      vendorName: vendorTable.name,
    })
    .from(billTable)
    .innerJoin(vendorTable, eq(billTable.vendorId, vendorTable.id))
    .where(
      and(
        eq(billTable.bookId, bookId),
        inArray(billTable.status, ["open", "partial"]),
        lte(billTable.billDate, asOfDate),
      ),
    );

  const vendorMap = new Map<
    string,
    {
      vendorId: string;
      vendorName: string;
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

    let bucket = vendorMap.get(row.vendorId);
    if (!bucket) {
      bucket = {
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
      };
      vendorMap.set(row.vendorId, bucket);
    }

    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.days1to30 += outstanding;
    else if (daysOverdue <= 60) bucket.days31to60 += outstanding;
    else if (daysOverdue <= 90) bucket.days61to90 += outstanding;
    else bucket.over90 += outstanding;
  }

  const vendors: ApAgingVendorRow[] = [];
  const totals = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };

  for (const bucket of vendorMap.values()) {
    const total =
      bucket.current +
      bucket.days1to30 +
      bucket.days31to60 +
      bucket.days61to90 +
      bucket.over90;
    if (total <= 0.00005) continue;

    vendors.push({
      vendorId: bucket.vendorId,
      vendorName: bucket.vendorName,
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
    reportType: "ap",
    vendors,
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

export default generateApAging;
