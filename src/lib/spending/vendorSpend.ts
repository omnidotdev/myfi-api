import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";

/** A vendor appearing in at least this many distinct months reads as recurring */
const RECURRING_MONTH_THRESHOLD = 3;

const UNASSIGNED_LABEL = "(Unassigned)";

type VendorSpendRow = {
  vendorId: string | null;
  vendorName: string;
  /** month (YYYY-MM) -> net spend for that month, only months with activity */
  monthly: Record<string, string>;
  total: string;
  monthsActive: number;
  isRecurring: boolean;
};

type VendorSpendResult = {
  months: string[];
  vendors: VendorSpendRow[];
  monthlyTotals: Record<string, string>;
  grandTotal: string;
  period: { startDate: string; endDate: string };
  generatedAt: string;
};

/** Inclusive list of YYYY-MM months spanning the range */
const monthsInRange = (startDate: string, endDate: string): string[] => {
  const [sy, sm] = startDate.slice(0, 7).split("-").map(Number);
  const [ey, em] = endDate.slice(0, 7).split("-").map(Number);
  const months: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
};

/**
 * Spend per vendor per month across a date range, built from expense-account
 * journal lines grouped by the entry's vendor. Each vendor row carries its
 * monthly amounts, a total, and a recurring flag (active in at least three
 * months). Entries with no vendor are grouped under "(Unassigned)"
 */
const getVendorSpend = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<VendorSpendResult> => {
  const { bookId, startDate, endDate } = params;

  const rows = await dbPool
    .select({
      vendorId: journalEntryTable.vendorId,
      vendorName: vendorTable.name,
      month: sql<string>`to_char(${journalEntryTable.date}, 'YYYY-MM')`,
      debitTotal: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
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
        eq(journalEntryTable.bookId, bookId),
        eq(accountTable.type, "expense"),
        between(journalEntryTable.date, startDate, endDate),
      ),
    )
    .groupBy(
      journalEntryTable.vendorId,
      vendorTable.name,
      sql`to_char(${journalEntryTable.date}, 'YYYY-MM')`,
    );

  const months = monthsInRange(startDate, endDate);
  const monthlyTotals: Record<string, number> = {};
  const byVendor = new Map<
    string,
    {
      vendorId: string | null;
      vendorName: string;
      monthly: Record<string, number>;
    }
  >();

  for (const row of rows) {
    const net =
      Number.parseFloat(row.debitTotal) - Number.parseFloat(row.creditTotal);
    if (net === 0) continue;

    const key = row.vendorId ?? "__unassigned__";
    let vendor = byVendor.get(key);
    if (!vendor) {
      vendor = {
        vendorId: row.vendorId,
        vendorName: row.vendorId
          ? (row.vendorName ?? UNASSIGNED_LABEL)
          : UNASSIGNED_LABEL,
        monthly: {},
      };
      byVendor.set(key, vendor);
    }
    vendor.monthly[row.month] = (vendor.monthly[row.month] ?? 0) + net;
    monthlyTotals[row.month] = (monthlyTotals[row.month] ?? 0) + net;
  }

  const vendors: VendorSpendRow[] = [...byVendor.values()]
    .map((v) => {
      const monthly: Record<string, string> = {};
      let total = 0;
      let monthsActive = 0;
      for (const [month, amount] of Object.entries(v.monthly)) {
        monthly[month] = amount.toFixed(4);
        total += amount;
        monthsActive += 1;
      }
      return {
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        monthly,
        total: total.toFixed(4),
        monthsActive,
        isRecurring: monthsActive >= RECURRING_MONTH_THRESHOLD,
      };
    })
    .sort((a, b) => Number.parseFloat(b.total) - Number.parseFloat(a.total));

  let grandTotal = 0;
  const monthlyTotalsStr: Record<string, string> = {};
  for (const month of months) {
    const amount = monthlyTotals[month] ?? 0;
    monthlyTotalsStr[month] = amount.toFixed(4);
    grandTotal += amount;
  }

  return {
    months,
    vendors,
    monthlyTotals: monthlyTotalsStr,
    grandTotal: grandTotal.toFixed(4),
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
  };
};

export default getVendorSpend;
