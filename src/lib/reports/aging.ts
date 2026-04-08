import { and, eq, lte } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";

type AgingBuckets = {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  total: string;
};

type AgingVendorRow = {
  vendorId: string | null;
  vendorName: string;
} & AgingBuckets;

type AgingReport = {
  bookId: string;
  asOfDate: string;
  reportType: "ap" | "ar";
  vendors: AgingVendorRow[];
  totals: AgingBuckets;
  generatedAt: string;
};

const DAY_MS = 86_400_000;

/**
 * Generate an AP or AR aging report grouped by vendor.
 */
const generateAgingReport = async (params: {
  bookId: string;
  asOfDate: string;
  accountSubType: "accounts_payable" | "accounts_receivable";
}): Promise<AgingReport> => {
  const { bookId, asOfDate, accountSubType } = params;
  const asOfMs = new Date(asOfDate).getTime();

  const reportType: "ap" | "ar" =
    accountSubType === "accounts_payable" ? "ap" : "ar";

  // Query all journal lines on matching accounts with entry date <= asOfDate
  const rows = await dbPool
    .select({
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
      entryDate: journalEntryTable.date,
      vendorId: journalEntryTable.vendorId,
      vendorName: vendorTable.name,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
    .leftJoin(vendorTable, eq(journalEntryTable.vendorId, vendorTable.id))
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, accountSubType),
        lte(journalEntryTable.date, asOfDate),
      ),
    );

  // Group by vendor into aging buckets
  const vendorMap = new Map<
    string,
    {
      vendorId: string | null;
      vendorName: string;
      current: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      over90: number;
    }
  >();

  for (const row of rows) {
    const amount =
      (Number.parseFloat(row.debit as string) || 0) -
      (Number.parseFloat(row.credit as string) || 0);
    const entryMs = new Date(row.entryDate).getTime();
    const daysSince = Math.floor((asOfMs - entryMs) / DAY_MS);

    const key = row.vendorId ?? "__no_vendor__";
    let bucket = vendorMap.get(key);

    if (!bucket) {
      bucket = {
        vendorId: row.vendorId,
        vendorName: (row.vendorName as string) ?? "Unknown",
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
      };
      vendorMap.set(key, bucket);
    }

    if (daysSince <= 0) bucket.current += amount;
    else if (daysSince <= 30) bucket.days1to30 += amount;
    else if (daysSince <= 60) bucket.days31to60 += amount;
    else if (daysSince <= 90) bucket.days61to90 += amount;
    else bucket.over90 += amount;
  }

  // Build vendor rows, filtering out zero-balance vendors
  const vendors: AgingVendorRow[] = [];
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

    if (Math.abs(total) < 0.00005) continue;

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
    reportType,
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

export default generateAgingReport;
