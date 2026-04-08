import { and, between, eq, like, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  mileageLogTable,
} from "lib/db/schema";

// Standard IRS mileage rates by tax year
const IRS_MILEAGE_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.7,
  2026: 0.7,
};

const getMileageRate = (year: number): number =>
  IRS_MILEAGE_RATES[year] ?? IRS_MILEAGE_RATES[2025];

/**
 * IRS expense category mapped from account sub-types and names
 */
type IrsExpenseCategory =
  | "advertising"
  | "car_and_truck"
  | "commissions"
  | "contract_labor"
  | "depreciation"
  | "insurance"
  | "interest"
  | "legal_and_professional"
  | "office_expense"
  | "rent"
  | "repairs"
  | "supplies"
  | "taxes_and_licenses"
  | "travel"
  | "meals"
  | "utilities"
  | "wages"
  | "other";

type ScheduleCCategory = {
  category: IrsExpenseCategory;
  label: string;
  lineNumber: number;
  amount: string;
};

type ScheduleCReport = {
  bookId: string;
  year: number;
  grossIncome: string;
  categories: ScheduleCCategory[];
  totalExpenses: string;
  netProfitOrLoss: string;
  generatedAt: string;
};

/**
 * Map from IRS expense category to Schedule C line number and label
 */
const CATEGORY_META: Record<
  IrsExpenseCategory,
  { label: string; lineNumber: number }
> = {
  advertising: { label: "Advertising", lineNumber: 8 },
  car_and_truck: { label: "Car and truck expenses", lineNumber: 9 },
  commissions: { label: "Commissions and fees", lineNumber: 10 },
  contract_labor: { label: "Contract labor", lineNumber: 11 },
  depreciation: { label: "Depreciation", lineNumber: 13 },
  insurance: { label: "Insurance (other than health)", lineNumber: 15 },
  interest: { label: "Interest (mortgage/other)", lineNumber: 16 },
  legal_and_professional: {
    label: "Legal and professional services",
    lineNumber: 17,
  },
  office_expense: { label: "Office expense", lineNumber: 18 },
  rent: { label: "Rent or lease", lineNumber: 20 },
  repairs: { label: "Repairs and maintenance", lineNumber: 21 },
  supplies: { label: "Supplies", lineNumber: 22 },
  taxes_and_licenses: { label: "Taxes and licenses", lineNumber: 23 },
  travel: { label: "Travel", lineNumber: 24 },
  meals: { label: "Meals (50% deductible)", lineNumber: 24 },
  utilities: { label: "Utilities", lineNumber: 25 },
  wages: { label: "Wages", lineNumber: 26 },
  other: { label: "Other expenses", lineNumber: 27 },
};

/**
 * Derive IRS expense category from account name and sub-type.
 * Uses keyword matching on account name, falling back to sub-type mapping
 */
const deriveExpenseCategory = (
  accountName: string,
  subType: string | null,
): IrsExpenseCategory => {
  const name = accountName.toLowerCase();

  if (name.includes("advertis") || name.includes("marketing"))
    return "advertising";
  if (name.includes("car") || name.includes("truck") || name.includes("auto"))
    return "car_and_truck";
  if (name.includes("commission")) return "commissions";
  if (name.includes("contract") || name.includes("freelanc"))
    return "contract_labor";
  if (name.includes("depreci") || name.includes("amortiz"))
    return "depreciation";
  if (name.includes("insurance")) return "insurance";
  if (name.includes("interest")) return "interest";
  if (name.includes("legal") || name.includes("professional"))
    return "legal_and_professional";
  if (name.includes("office")) return "office_expense";
  if (name.includes("rent") || name.includes("lease")) return "rent";
  if (name.includes("repair") || name.includes("maintenance")) return "repairs";
  if (name.includes("suppli")) return "supplies";
  if (name.includes("tax") || name.includes("license"))
    return "taxes_and_licenses";
  if (name.includes("travel")) return "travel";
  if (name.includes("meal") || name.includes("food")) return "meals";
  if (
    name.includes("utilit") ||
    name.includes("electric") ||
    name.includes("phone")
  )
    return "utilities";
  if (
    name.includes("wage") ||
    name.includes("salary") ||
    name.includes("payroll")
  )
    return "wages";

  // Fall back to sub-type
  if (subType === "payroll") return "wages";
  if (subType === "tax_expense") return "taxes_and_licenses";

  return "other";
};

/**
 * Generate a Schedule C (self-employment income) report for a given tax year.
 * Groups revenue and expenses by IRS categories derived from account metadata
 * @param params - Book ID and tax year
 * @returns Schedule C report with gross income, categorized expenses, and net profit/loss
 */
const generateScheduleC = async (params: {
  bookId: string;
  year: number;
}): Promise<ScheduleCReport> => {
  const { bookId, year } = params;
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  const results = await dbPool
    .select({
      accountName: accountTable.name,
      accountType: accountTable.type,
      subType: accountTable.subType,
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
    .groupBy(accountTable.name, accountTable.type, accountTable.subType);

  let grossIncome = 0;
  const categoryTotals = new Map<IrsExpenseCategory, number>();

  for (const row of results) {
    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    if (row.accountType === "revenue") {
      // Revenue: credits increase, debits decrease
      grossIncome += credit - debit;
    } else {
      // Expense: debits increase, credits decrease
      const amount = debit - credit;
      const category = deriveExpenseCategory(row.accountName, row.subType);
      categoryTotals.set(
        category,
        (categoryTotals.get(category) ?? 0) + amount,
      );
    }
  }

  // Add mileage-based car and truck deduction
  const [mileageResult] = await dbPool
    .select({
      totalMiles: sql<string>`coalesce(sum(${mileageLogTable.distance}), 0)`,
    })
    .from(mileageLogTable)
    .where(
      and(
        eq(mileageLogTable.bookId, bookId),
        like(mileageLogTable.date, `${year}%`),
      ),
    );

  const totalMiles = Number(mileageResult?.totalMiles ?? 0);

  if (totalMiles > 0) {
    const mileageDeduction = totalMiles * getMileageRate(year);
    categoryTotals.set(
      "car_and_truck",
      (categoryTotals.get("car_and_truck") ?? 0) + mileageDeduction,
    );
  }

  const categories: ScheduleCCategory[] = [];
  let totalExpenses = 0;

  for (const [category, amount] of categoryTotals.entries()) {
    if (amount === 0) continue;

    const meta = CATEGORY_META[category];
    categories.push({
      category,
      label: meta.label,
      lineNumber: meta.lineNumber,
      amount: amount.toFixed(2),
    });

    totalExpenses += amount;
  }

  // Sort by line number for consistent ordering
  categories.sort((a, b) => a.lineNumber - b.lineNumber);

  return {
    bookId,
    year,
    grossIncome: grossIncome.toFixed(2),
    categories,
    totalExpenses: totalExpenses.toFixed(2),
    netProfitOrLoss: (grossIncome - totalExpenses).toFixed(2),
    generatedAt: new Date().toISOString(),
  };
};

export default generateScheduleC;
