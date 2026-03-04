import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type QuarterEstimate = {
  quarter: number;
  label: string;
  dueDate: string;
  estimatedPayment: string;
  cumulativeIncome: string;
  cumulativeTax: string;
};

type QuarterlyEstimatesReport = {
  bookId: string;
  year: number;
  annualProjectedIncome: string;
  selfEmploymentTax: string;
  estimatedIncomeTax: string;
  totalEstimatedTax: string;
  quarters: QuarterEstimate[];
  safeHarbor: {
    currentYear90Pct: string;
    priorYear100Pct: string | null;
  };
  generatedAt: string;
};

/** Self-employment tax rate (Social Security 12.4% + Medicare 2.9%) */
const _SE_TAX_RATE = 0.153;

/** SE income factor (92.35% of net earnings subject to SE tax) */
const SE_INCOME_FACTOR = 0.9235;

/** Social Security wage base for 2025 */
const SS_WAGE_BASE = 168_600;

/** Social Security rate (employer + employee portions) */
const SS_RATE = 0.124;

/** Medicare rate (employer + employee portions) */
const MEDICARE_RATE = 0.029;

/**
 * Simplified 2025 federal income tax brackets (single filer)
 */
const TAX_BRACKETS = [
  { min: 0, max: 11_600, rate: 0.1 },
  { min: 11_600, max: 47_150, rate: 0.12 },
  { min: 47_150, max: 100_525, rate: 0.22 },
  { min: 100_525, max: 191_950, rate: 0.24 },
  { min: 191_950, max: 243_725, rate: 0.32 },
  { min: 243_725, max: 609_350, rate: 0.35 },
  { min: 609_350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

/** IRS quarterly due dates */
const QUARTER_DUE_DATES: Record<number, { label: string; dueDate: string }> = {
  1: { label: "Q1 (Jan-Mar)", dueDate: "-04-15" },
  2: { label: "Q2 (Apr-May)", dueDate: "-06-15" },
  3: { label: "Q3 (Jun-Aug)", dueDate: "-09-15" },
  4: { label: "Q4 (Sep-Dec)", dueDate: "-01-15" },
};

/**
 * Calculate federal income tax using progressive brackets
 */
const calculateIncomeTax = (taxableIncome: number): number => {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.min) break;

    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
};

/**
 * Calculate self-employment tax
 */
const calculateSETax = (netIncome: number): number => {
  if (netIncome <= 0) return 0;

  const seIncome = netIncome * SE_INCOME_FACTOR;

  // Social Security portion (capped at wage base)
  const ssTaxable = Math.min(seIncome, SS_WAGE_BASE);
  const ssTax = ssTaxable * SS_RATE;

  // Medicare portion (no cap)
  const medicareTax = seIncome * MEDICARE_RATE;

  return ssTax + medicareTax;
};

/**
 * Query net self-employment income for a date range
 */
const queryNetIncome = async (
  bookId: string,
  startDate: string,
  endDate: string,
): Promise<number> => {
  const results = await dbPool
    .select({
      accountType: accountTable.type,
      debitTotal: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
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
        between(journalEntryTable.date, startDate, endDate),
        sql`${accountTable.type} in ('revenue', 'expense')`,
      ),
    )
    .groupBy(accountTable.type);

  let revenue = 0;
  let expenses = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    if (row.accountType === "revenue") {
      revenue += credit - debit;
    } else {
      expenses += debit - credit;
    }
  }

  return revenue - expenses;
};

/**
 * Generate quarterly estimated tax calculations for self-employed filers.
 * Computes self-employment tax, income tax, and per-quarter payments
 * @param params - Book ID and tax year
 * @returns Quarterly estimates with due dates and safe harbor amounts
 */
const generateQuarterlyEstimates = async (params: {
  bookId: string;
  year: number;
}): Promise<QuarterlyEstimatesReport> => {
  const { bookId, year } = params;

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year}-12-31T23:59:59.999Z`;

  // Get YTD net income
  const ytdIncome = await queryNetIncome(bookId, yearStart, yearEnd);

  // Project annual income from YTD (proportional estimate)
  const now = new Date();
  const currentYear = now.getFullYear();
  let projectionFactor = 1;

  if (currentYear === year) {
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(`${year}-01-01`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    projectionFactor = dayOfYear > 0 ? 365 / dayOfYear : 1;
  }

  const projectedAnnualIncome = ytdIncome * projectionFactor;

  // Calculate taxes
  const seTax = calculateSETax(projectedAnnualIncome);

  // Deduct half of SE tax from income for income tax purposes
  const adjustedIncome = projectedAnnualIncome - seTax / 2;
  const incomeTax = calculateIncomeTax(adjustedIncome);

  const totalTax = seTax + incomeTax;
  const perQuarterPayment = totalTax / 4;

  // Build per-quarter breakdown
  const quarters: QuarterEstimate[] = [];
  const quarterEndDates = [
    `${year}-03-31T23:59:59.999Z`,
    `${year}-05-31T23:59:59.999Z`,
    `${year}-08-31T23:59:59.999Z`,
    `${year}-12-31T23:59:59.999Z`,
  ];

  for (let q = 1; q <= 4; q++) {
    const meta = QUARTER_DUE_DATES[q];
    // Q4 due date is January of next year
    const dueDateYear = q === 4 ? year + 1 : year;
    const dueDate = `${dueDateYear}${meta.dueDate}`;

    // Cumulative income through this quarter
    const cumIncome = await queryNetIncome(
      bookId,
      yearStart,
      quarterEndDates[q - 1],
    );

    const cumSeTax = calculateSETax(cumIncome);
    const cumAdjusted = cumIncome - cumSeTax / 2;
    const cumIncomeTax = calculateIncomeTax(cumAdjusted);
    const cumTax = cumSeTax + cumIncomeTax;

    quarters.push({
      quarter: q,
      label: meta.label,
      dueDate,
      estimatedPayment: perQuarterPayment.toFixed(2),
      cumulativeIncome: cumIncome.toFixed(2),
      cumulativeTax: cumTax.toFixed(2),
    });
  }

  // Safe harbor: 90% of current year or 100% of prior year
  // Prior year data not available without separate query, so return null
  const priorYearStart = `${year - 1}-01-01T00:00:00.000Z`;
  const priorYearEnd = `${year - 1}-12-31T23:59:59.999Z`;
  const priorYearIncome = await queryNetIncome(
    bookId,
    priorYearStart,
    priorYearEnd,
  );
  const priorSeTax = calculateSETax(priorYearIncome);
  const priorAdjusted = priorYearIncome - priorSeTax / 2;
  const priorIncomeTax = calculateIncomeTax(priorAdjusted);
  const priorTotalTax = priorSeTax + priorIncomeTax;

  return {
    bookId,
    year,
    annualProjectedIncome: projectedAnnualIncome.toFixed(2),
    selfEmploymentTax: seTax.toFixed(2),
    estimatedIncomeTax: incomeTax.toFixed(2),
    totalEstimatedTax: totalTax.toFixed(2),
    quarters,
    safeHarbor: {
      currentYear90Pct: (totalTax * 0.9).toFixed(2),
      priorYear100Pct: priorYearIncome > 0 ? priorTotalTax.toFixed(2) : null,
    },
    generatedAt: new Date().toISOString(),
  };
};

export default generateQuarterlyEstimates;
