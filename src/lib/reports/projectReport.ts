import { and, between, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineProjectTable,
  journalLineTable,
  projectTable,
} from "lib/db/schema";

import type { SelectProject } from "lib/db/schema";

type ProjectPnlLineItem = {
  accountId: string;
  accountName: string;
  accountCode: string | null;
  accountType: string;
  totalDebit: string;
  totalCredit: string;
};

type ProjectPnlReport = {
  project: SelectProject;
  revenue: ProjectPnlLineItem[];
  expenses: ProjectPnlLineItem[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  budgetAmount: number | null;
  budgetRemaining: number | null;
  generatedAt: string;
};

type ProjectSummaryItem = SelectProject & {
  totalSpend: number;
  budgetRemaining: number | null;
};

type ProjectSummaryReport = {
  projects: ProjectSummaryItem[];
  generatedAt: string;
};

/**
 * Generate a project-level Profit & Loss report by querying journal lines
 * assigned to the project, grouped by account (revenue vs expense).
 * @param params - Project ID, book ID, and optional date range
 * @returns Project P&L with revenue, expenses, and budget tracking
 */
const generateProjectPnl = async (params: {
  projectId: string;
  bookId: string;
  startDate?: string;
  endDate?: string;
}): Promise<ProjectPnlReport> => {
  const { projectId, bookId, startDate, endDate } = params;

  // Fetch the project
  const [project] = await dbPool
    .select()
    .from(projectTable)
    .where(
      and(eq(projectTable.id, projectId), eq(projectTable.bookId, bookId)),
    );

  if (!project) {
    throw new Error("Project not found");
  }

  // Query journal lines assigned to this project, grouped by account
  const dateConditions =
    startDate && endDate
      ? [between(journalEntryTable.date, startDate, endDate)]
      : [];

  const results = await dbPool
    .select({
      accountId: accountTable.id,
      accountName: accountTable.name,
      accountCode: accountTable.code,
      accountType: accountTable.type,
      totalDebit: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalLineProjectTable,
      eq(journalLineTable.id, journalLineProjectTable.journalLineId),
    )
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
    .where(
      and(
        eq(journalLineProjectTable.projectId, projectId),
        eq(journalEntryTable.bookId, bookId),
        sql`${accountTable.type} in ('revenue', 'expense')`,
        ...dateConditions,
      ),
    )
    .groupBy(
      accountTable.id,
      accountTable.name,
      accountTable.code,
      accountTable.type,
    );

  const revenue: ProjectPnlLineItem[] = [];
  const expenses: ProjectPnlLineItem[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const row of results) {
    const debit = Number.parseFloat(row.totalDebit);
    const credit = Number.parseFloat(row.totalCredit);

    if (row.accountType === "revenue") {
      revenue.push(row);
      totalRevenue += credit - debit;
    } else {
      expenses.push(row);
      totalExpenses += debit - credit;
    }
  }

  const netIncome = totalRevenue - totalExpenses;
  const budgetAmount = project.budgetAmount
    ? Number(project.budgetAmount)
    : null;
  const budgetRemaining =
    budgetAmount !== null ? budgetAmount - totalExpenses : null;

  return {
    project,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome,
    budgetAmount,
    budgetRemaining,
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a summary of all projects in a book with total spend and
 * budget remaining for each.
 * @param bookId - The book to summarize projects for
 * @returns All projects with spend and budget tracking
 */
const generateProjectSummary = async (
  bookId: string,
): Promise<ProjectSummaryReport> => {
  // Fetch all projects for the book
  const allProjects = await dbPool
    .select()
    .from(projectTable)
    .where(eq(projectTable.bookId, bookId));

  // Compute total expense spend per project in a single query
  const spendRows = await dbPool
    .select({
      projectId: journalLineProjectTable.projectId,
      totalDebit: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalLineProjectTable,
      eq(journalLineTable.id, journalLineProjectTable.journalLineId),
    )
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(accountTable.type, "expense"),
      ),
    )
    .groupBy(journalLineProjectTable.projectId);

  const spendMap = new Map<string, number>();

  for (const row of spendRows) {
    const spend =
      Number.parseFloat(row.totalDebit) - Number.parseFloat(row.totalCredit);
    spendMap.set(row.projectId, spend);
  }

  const projects: ProjectSummaryItem[] = allProjects.map((project) => {
    const totalSpend = spendMap.get(project.id) ?? 0;
    const budgetRemaining =
      project.budgetAmount !== null
        ? Number(project.budgetAmount) - totalSpend
        : null;

    return {
      ...project,
      totalSpend,
      budgetRemaining,
    };
  });

  return {
    projects,
    generatedAt: new Date().toISOString(),
  };
};

export { generateProjectPnl, generateProjectSummary };
