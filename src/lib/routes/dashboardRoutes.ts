import { and, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  accountingPeriodTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";

// Multi-book dashboard summary routes
const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" }).get(
  "/summary",
  async ({ query, set }) => {
    const { organizationId } = query;

    if (!organizationId) {
      set.status = 400;
      return { error: "organizationId is required" };
    }

    // Fetch all books for the organization
    const books = await dbPool
      .select({ id: bookTable.id, name: bookTable.name, type: bookTable.type })
      .from(bookTable)
      .where(eq(bookTable.organizationId, organizationId));

    if (!books.length) {
      return { books: [], pendingReviewCount: 0, totalNetWorth: "0.0000" };
    }

    const bookIds = books.map((b) => b.id);

    // Net worth per book (assets - liabilities)
    const balances = await dbPool
      .select({
        bookId: journalEntryTable.bookId,
        accountType: accountTable.type,
        balance: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
      .where(sql`${journalEntryTable.bookId} IN ${bookIds}`)
      .groupBy(journalEntryTable.bookId, accountTable.type);

    // Build per-book summaries
    const bookSummaries = books.map((book) => {
      const bookBalances = balances.filter((b) => b.bookId === book.id);
      let totalAssets = 0;
      let totalLiabilities = 0;

      for (const b of bookBalances) {
        const val = Number.parseFloat(b.balance);
        if (b.accountType === "asset") totalAssets += val;
        // Liabilities are credit-normal, so negate
        if (b.accountType === "liability") totalLiabilities -= val;
      }

      return {
        ...book,
        totalAssets: totalAssets.toFixed(4),
        totalLiabilities: totalLiabilities.toFixed(4),
        netWorth: (totalAssets - totalLiabilities).toFixed(4),
      };
    });

    // Pending reconciliation count across all books
    const [pendingResult] = await dbPool
      .select({ count: sql<number>`count(*)` })
      .from(reconciliationQueueTable)
      .where(
        sql`${reconciliationQueueTable.bookId} IN ${bookIds} AND ${reconciliationQueueTable.status} = 'pending_review'`,
      );

    return {
      books: bookSummaries,
      pendingReviewCount: Number(pendingResult?.count ?? 0),
      totalNetWorth: bookSummaries
        .reduce((sum, b) => sum + Number.parseFloat(b.netWorth), 0)
        .toFixed(4),
    };
  },
);

// Close status for all books in an organization
dashboardRoutes.get("/close-status", async ({ query, set }) => {
  const { organizationId } = query;

  if (!organizationId) {
    set.status = 400;
    return { error: "organizationId is required" };
  }

  const books = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.organizationId, organizationId));

  // Target the previous month
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;

  const statuses = [];

  for (const book of books) {
    const [period] = await dbPool
      .select()
      .from(accountingPeriodTable)
      .where(
        and(
          eq(accountingPeriodTable.bookId, book.id),
          eq(accountingPeriodTable.year, year),
          eq(accountingPeriodTable.month, month),
        ),
      );

    const [pendingResult] = await dbPool
      .select({ count: sql<number>`count(*)` })
      .from(reconciliationQueueTable)
      .where(
        and(
          eq(reconciliationQueueTable.bookId, book.id),
          eq(reconciliationQueueTable.status, "pending_review"),
        ),
      );

    statuses.push({
      bookId: book.id,
      bookName: book.name,
      year,
      month,
      periodStatus: period?.status ?? "open",
      closedAt: period?.closedAt ?? null,
      pendingReviewCount: Number(pendingResult?.count ?? 0),
      blockers: period?.blockers ?? null,
    });
  }

  return { statuses, year, month };
});

export default dashboardRoutes;
