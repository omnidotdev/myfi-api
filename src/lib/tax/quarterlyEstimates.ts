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
  qbiDeduction: string;
  estimatedIncomeTax: string;
  totalEstimatedTax: string;
  quarters: QuarterEstimate[];
  safeHarbor: {
    currentYear90Pct: string;
    priorYear100Pct: string | null;
  };
  generatedAt: string;
};

/** SE income factor (92.35% of net earnings subject to SE tax) */
const SE_INCOME_FACTOR = 0.9235;

/** Social Security rate (employer + employee portions) */
const SS_RATE = 0.124;

/** Medicare rate (employer + employee portions) */
const MEDICARE_RATE = 0.029;

/** Prior-year AGI above which the safe-harbor floor is 110%, not 100% */
const HIGH_INCOME_SAFE_HARBOR_THRESHOLD = 150_000;

/** Section 199A qualified business income deduction rate */
const QBI_RATE = 0.2;

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

interface YearTaxConstants {
  /** Social Security wage base (taxable maximum) for the year */
  ssWageBase: number;
  /** Single-filer standard deduction for the year */
  standardDeduction: number;
  /** Single-filer federal income tax brackets for the year */
  brackets: TaxBracket[];
}

/**
 * Federal tax constants by year (single filer). These change every year, so
 * they are keyed by year rather than hardcoded to one; an unknown (future) year
 * falls back to the latest known year. Verified against IRS figures and the
 * OBBBA-adjusted 2025 standard deduction. Update this table each tax year
 */
const TAX_YEARS: Record<number, YearTaxConstants> = {
  2024: {
    ssWageBase: 168_600,
    standardDeduction: 14_600,
    brackets: [
      { min: 0, max: 11_600, rate: 0.1 },
      { min: 11_600, max: 47_150, rate: 0.12 },
      { min: 47_150, max: 100_525, rate: 0.22 },
      { min: 100_525, max: 191_950, rate: 0.24 },
      { min: 191_950, max: 243_725, rate: 0.32 },
      { min: 243_725, max: 609_350, rate: 0.35 },
      { min: 609_350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
    ],
  },
  2025: {
    ssWageBase: 176_100,
    standardDeduction: 15_750,
    brackets: [
      { min: 0, max: 11_925, rate: 0.1 },
      { min: 11_925, max: 48_475, rate: 0.12 },
      { min: 48_475, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_525, rate: 0.32 },
      { min: 250_525, max: 626_350, rate: 0.35 },
      { min: 626_350, max: Number.POSITIVE_INFINITY, rate: 0.37 },
    ],
  },
  2026: {
    ssWageBase: 184_500,
    standardDeduction: 16_100,
    brackets: [
      { min: 0, max: 12_400, rate: 0.1 },
      { min: 12_400, max: 50_400, rate: 0.12 },
      { min: 50_400, max: 105_700, rate: 0.22 },
      { min: 105_700, max: 201_775, rate: 0.24 },
      { min: 201_775, max: 256_225, rate: 0.32 },
      { min: 256_225, max: 640_600, rate: 0.35 },
      { min: 640_600, max: Number.POSITIVE_INFINITY, rate: 0.37 },
    ],
  },
};

const LATEST_TAX_YEAR = 2026;

const constantsForYear = (year: number): YearTaxConstants =>
  TAX_YEARS[year] ?? TAX_YEARS[LATEST_TAX_YEAR];

/** IRS quarterly due dates */
const QUARTER_DUE_DATES: Record<number, { label: string; dueDate: string }> = {
  1: { label: "Q1 (Jan-Mar)", dueDate: "-04-15" },
  2: { label: "Q2 (Apr-May)", dueDate: "-06-15" },
  3: { label: "Q3 (Jun-Aug)", dueDate: "-09-15" },
  4: { label: "Q4 (Sep-Dec)", dueDate: "-01-15" },
};

/**
 * Calculate federal income tax using the given year's progressive brackets
 */
const calculateIncomeTax = (
  taxableIncome: number,
  brackets: TaxBracket[],
): number => {
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;

    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
};

/**
 * Calculate self-employment tax against the given year's Social Security base
 */
const calculateSETax = (netIncome: number, ssWageBase: number): number => {
  if (netIncome <= 0) return 0;

  const seIncome = netIncome * SE_INCOME_FACTOR;

  // Social Security portion (capped at wage base)
  const ssTaxable = Math.min(seIncome, ssWageBase);
  const ssTax = ssTaxable * SS_RATE;

  // Medicare portion (no cap)
  const medicareTax = seIncome * MEDICARE_RATE;

  return ssTax + medicareTax;
};

/**
 * The Section 199A taxable-income threshold for the year, above which the
 * deduction is limited by W-2 wages / UBIA and phased out for specified service
 * businesses. For a single filer this equals the top of the 24% bracket, so it
 * is derived from the bracket table rather than hardcoded separately
 */
const qbiThresholdForYear = (constants: YearTaxConstants): number =>
  constants.brackets.find((bracket) => bracket.rate === 0.32)?.min ??
  Number.POSITIVE_INFINITY;

/**
 * Compute SE tax, income tax, the QBI deduction, and their total for a
 * self-employed single filer from net self-employment income, using the given
 * year's constants.
 *
 * Income tax is computed on taxable income: net income, less the deductible
 * half of SE tax, less the year's standard deduction, less the Section 199A
 * qualified business income (QBI) deduction (each floored at zero).
 *
 * QBI is 20% of qualified business income (net income reduced by the deductible
 * half of SE tax), capped at 20% of taxable income before the deduction. Below
 * the year's 199A threshold this is the full, correct deduction. At or above the
 * threshold the deduction is limited by W-2 wages / UBIA and phased out for
 * service businesses, none of which can be determined from one book, so the
 * estimate conservatively omits it there rather than risk understating tax
 */
export const computeSelfEmploymentTaxes = (params: {
  netIncome: number;
  year: number;
}): {
  seTax: number;
  incomeTax: number;
  qbiDeduction: number;
  totalTax: number;
} => {
  const { netIncome, year } = params;
  const constants = constantsForYear(year);

  const seTax = calculateSETax(netIncome, constants.ssWageBase);
  const taxableBeforeQbi = Math.max(
    0,
    netIncome - seTax / 2 - constants.standardDeduction,
  );

  const qbiIncome = Math.max(0, netIncome - seTax / 2);
  const qbiDeduction =
    taxableBeforeQbi <= qbiThresholdForYear(constants)
      ? Math.min(QBI_RATE * qbiIncome, QBI_RATE * taxableBeforeQbi)
      : 0;

  const taxableIncome = Math.max(0, taxableBeforeQbi - qbiDeduction);
  const incomeTax = calculateIncomeTax(taxableIncome, constants.brackets);

  return { seTax, incomeTax, qbiDeduction, totalTax: seTax + incomeTax };
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

  // Calculate taxes (SE tax + income tax net of the standard deduction)
  const { seTax, incomeTax, qbiDeduction, totalTax } =
    computeSelfEmploymentTaxes({
      netIncome: projectedAnnualIncome,
      year,
    });
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

    const { totalTax: cumTax } = computeSelfEmploymentTaxes({
      netIncome: cumIncome,
      year,
    });

    quarters.push({
      quarter: q,
      label: meta.label,
      dueDate,
      estimatedPayment: perQuarterPayment.toFixed(2),
      cumulativeIncome: cumIncome.toFixed(2),
      cumulativeTax: cumTax.toFixed(2),
    });
  }

  // Safe harbor: the smaller of 90% of the current-year tax or the prior-year
  // floor. That floor is 100% of prior-year tax, but 110% when prior-year
  // income is above the high-income threshold ($150k), per the IRS rule
  const priorYearStart = `${year - 1}-01-01T00:00:00.000Z`;
  const priorYearEnd = `${year - 1}-12-31T23:59:59.999Z`;
  const priorYearIncome = await queryNetIncome(
    bookId,
    priorYearStart,
    priorYearEnd,
  );
  const { totalTax: priorTotalTax } = computeSelfEmploymentTaxes({
    netIncome: priorYearIncome,
    year: year - 1,
  });
  const priorSafeHarborPct =
    priorYearIncome > HIGH_INCOME_SAFE_HARBOR_THRESHOLD ? 1.1 : 1.0;

  return {
    bookId,
    year,
    annualProjectedIncome: projectedAnnualIncome.toFixed(2),
    selfEmploymentTax: seTax.toFixed(2),
    qbiDeduction: qbiDeduction.toFixed(2),
    estimatedIncomeTax: incomeTax.toFixed(2),
    totalEstimatedTax: totalTax.toFixed(2),
    quarters,
    safeHarbor: {
      currentYear90Pct: (totalTax * 0.9).toFixed(2),
      // Prior-year floor: 100% (or 110% for high earners) of prior-year tax
      priorYear100Pct:
        priorYearIncome > 0
          ? (priorTotalTax * priorSafeHarborPct).toFixed(2)
          : null,
    },
    generatedAt: new Date().toISOString(),
  };
};

export default generateQuarterlyEstimates;
