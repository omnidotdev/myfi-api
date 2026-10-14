import { and, eq, sql, sum } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";

type SalesTaxPeriod = {
  label: string;
  startDate: string;
  endDate: string;
  collected: string;
  remitted: string;
  owed: string;
};

type SalesTaxJurisdiction = {
  id: string;
  name: string;
  code: string | null;
  filingFrequency: string;
  periods: SalesTaxPeriod[];
  totalCollected: string;
  totalRemitted: string;
  totalOwed: string;
};

type SalesTaxReport = {
  year: number;
  jurisdictions: SalesTaxJurisdiction[];
};

/**
 * Build date periods based on filing frequency for a given year.
 */
const buildPeriods = (
  year: number,
  frequency: string,
): { label: string; startDate: string; endDate: string }[] => {
  if (frequency === "monthly") {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthStr = String(month).padStart(2, "0");
      const lastDay = new Date(year, month, 0).getDate();

      return {
        label: `${new Date(year, i).toLocaleString("en-US", { month: "short" })} ${year}`,
        startDate: `${year}-${monthStr}-01`,
        endDate: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
      };
    });
  }

  if (frequency === "quarterly") {
    return [
      {
        label: `Q1 ${year}`,
        startDate: `${year}-01-01`,
        endDate: `${year}-03-31`,
      },
      {
        label: `Q2 ${year}`,
        startDate: `${year}-04-01`,
        endDate: `${year}-06-30`,
      },
      {
        label: `Q3 ${year}`,
        startDate: `${year}-07-01`,
        endDate: `${year}-09-30`,
      },
      {
        label: `Q4 ${year}`,
        startDate: `${year}-10-01`,
        endDate: `${year}-12-31`,
      },
    ];
  }

  // annually
  return [
    {
      label: `${year}`,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    },
  ];
};

/**
 * Query credit and debit sums for a tax payable account within a date range.
 */
const queryPeriodTotals = async (
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<{ credits: string; debits: string }> => {
  const [result] = await dbPool
    .select({
      credits: sum(journalLineTable.credit),
      debits: sum(journalLineTable.debit),
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalLineTable.accountId, accountId),
        // Cast the timestamptz to a calendar date so an entry with a time-of-day
        // on the last day of the period is not dropped
        sql`${journalEntryTable.date}::date between ${startDate} and ${endDate}`,
      ),
    );

  return {
    credits: result?.credits ?? "0",
    debits: result?.debits ?? "0",
  };
};

/**
 * Generate a sales tax report for all (or a single) jurisdiction in a book.
 * @param params - Book ID, year, and optional jurisdiction filter
 * @returns Sales tax report with period breakdowns per jurisdiction
 */
const generateSalesTaxReport = async (params: {
  bookId: string;
  year: number;
  jurisdictionId?: string;
}): Promise<SalesTaxReport> => {
  const { bookId, year, jurisdictionId } = params;

  // Fetch jurisdictions
  const conditions = jurisdictionId
    ? and(
        eq(taxJurisdictionTable.bookId, bookId),
        eq(taxJurisdictionTable.id, jurisdictionId),
      )
    : eq(taxJurisdictionTable.bookId, bookId);

  const jurisdictions = await dbPool
    .select()
    .from(taxJurisdictionTable)
    .where(conditions);

  const result: SalesTaxJurisdiction[] = [];

  for (const jur of jurisdictions) {
    const periods = buildPeriods(year, jur.filingFrequency);
    const periodResults: SalesTaxPeriod[] = [];

    let totalCollected = 0;
    let totalRemitted = 0;
    let totalOwed = 0;

    for (const period of periods) {
      const totals = await queryPeriodTotals(
        jur.taxPayableAccountId,
        period.startDate,
        period.endDate,
      );

      // Credits to the tax-payable account are tax collected on sales; debits
      // are remittances to the authority. Vendor-bill tax paid no longer debits
      // this account (it is folded into expense under US treatment), so debits
      // here represent deliberate remittances rather than input-tax credits
      const collected = Number.parseFloat(totals.credits) || 0;
      const remitted = Number.parseFloat(totals.debits) || 0;
      const owed = collected - remitted;

      totalCollected += collected;
      totalRemitted += remitted;
      totalOwed += owed;

      periodResults.push({
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        collected: collected.toFixed(4),
        remitted: remitted.toFixed(4),
        owed: owed.toFixed(4),
      });
    }

    result.push({
      id: jur.id,
      name: jur.name,
      code: jur.code,
      filingFrequency: jur.filingFrequency,
      periods: periodResults,
      totalCollected: totalCollected.toFixed(4),
      totalRemitted: totalRemitted.toFixed(4),
      totalOwed: totalOwed.toFixed(4),
    });
  }

  return { year, jurisdictions: result };
};

export default generateSalesTaxReport;
