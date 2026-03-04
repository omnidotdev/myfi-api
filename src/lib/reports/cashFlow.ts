import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

type CashFlowLineItem = {
  accountId: string;
  accountCode: string | null;
  accountName: string;
  accountType: string;
  subType: string | null;
  netAmount: string;
};

type CashFlowSection = {
  items: CashFlowLineItem[];
  total: string;
};

type CashFlowReport = {
  bookId: string;
  startDate: string;
  endDate: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: string;
  generatedAt: string;
};

/** Sub-types that represent cash/checking accounts (excluded from investing) */
const CASH_SUB_TYPES = ["cash", "bank"];

/**
 * Classify an account into a cash flow category.
 * - Operating: revenue and expense accounts
 * - Investing: asset accounts (excluding cash/bank)
 * - Financing: liability and equity accounts
 */
const classifyAccount = (
  type: string,
  subType: string | null,
): "operating" | "investing" | "financing" | null => {
  if (type === "revenue" || type === "expense") return "operating";

  if (type === "asset") {
    // Cash and bank accounts are not investing activities
    if (subType && CASH_SUB_TYPES.includes(subType)) return null;
    return "investing";
  }

  if (type === "liability" || type === "equity") return "financing";

  return null;
};

/**
 * Generate a cash flow statement for a date range.
 * Classifies journal line activity into operating, investing, and financing
 * @param params - Book ID and date range
 * @returns Cash flow statement with three activity sections
 */
const generateCashFlow = async (params: {
  bookId: string;
  startDate: string;
  endDate: string;
}): Promise<CashFlowReport> => {
  const { bookId, startDate, endDate } = params;

  const results = await dbPool
    .select({
      accountId: accountTable.id,
      accountCode: accountTable.code,
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
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.code,
      accountTable.name,
      accountTable.type,
      accountTable.subType,
    );

  const operating: CashFlowLineItem[] = [];
  const investing: CashFlowLineItem[] = [];
  const financing: CashFlowLineItem[] = [];
  let operatingTotal = 0;
  let investingTotal = 0;
  let financingTotal = 0;

  for (const row of results) {
    const category = classifyAccount(row.accountType, row.subType);
    if (!category) continue;

    const debit = Number.parseFloat(row.debitTotal);
    const credit = Number.parseFloat(row.creditTotal);

    // Net cash impact: credits represent inflows, debits represent outflows
    // For revenue (credit-normal): credit - debit = positive cash
    // For expense (debit-normal): credit - debit = negative cash
    // For assets (debit-normal): credit - debit = cash released
    // For liabilities/equity (credit-normal): credit - debit = cash received
    const netAmount = credit - debit;

    const item: CashFlowLineItem = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      subType: row.subType,
      netAmount: netAmount.toFixed(4),
    };

    if (category === "operating") {
      operating.push(item);
      operatingTotal += netAmount;
    } else if (category === "investing") {
      investing.push(item);
      investingTotal += netAmount;
    } else {
      financing.push(item);
      financingTotal += netAmount;
    }
  }

  return {
    bookId,
    startDate,
    endDate,
    operating: {
      items: operating,
      total: operatingTotal.toFixed(4),
    },
    investing: {
      items: investing,
      total: investingTotal.toFixed(4),
    },
    financing: {
      items: financing,
      total: financingTotal.toFixed(4),
    },
    netCashChange: (operatingTotal + investingTotal + financingTotal).toFixed(
      4,
    ),
    generatedAt: new Date().toISOString(),
  };
};

export default generateCashFlow;
