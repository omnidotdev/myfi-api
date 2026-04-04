import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountingPeriodTable,
  bookTable,
  connectedAccountTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { saveNetWorthSnapshot } from "lib/netWorth/netWorthService";
import syncTransactions from "lib/plaid/syncTransactions";

type CloseResult = {
  bookId: string;
  bookName: string;
  year: number;
  month: number;
  status: "closed" | "blocked";
  blockers?: { pendingReviewCount: number };
};

/**
 * Run monthly close for all books, targeting the previous month.
 * Syncs connected accounts, checks for pending review items, and
 * either closes the period or records blockers.
 */
const runMonthlyClose = async (): Promise<CloseResult[]> => {
  const now = new Date();
  // Target the previous month
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;

  console.info(
    `[MonthlyClose] Starting close for period ${year}-${String(month).padStart(2, "0")}`,
  );

  const books = await dbPool.select().from(bookTable);

  const results: CloseResult[] = [];

  for (const book of books) {
    console.info(`[MonthlyClose] Processing book "${book.name}" (${book.id})`);

    // Check if period is already closed
    const [existingPeriod] = await dbPool
      .select()
      .from(accountingPeriodTable)
      .where(
        and(
          eq(accountingPeriodTable.bookId, book.id),
          eq(accountingPeriodTable.year, year),
          eq(accountingPeriodTable.month, month),
        ),
      );

    if (existingPeriod?.status === "closed") {
      console.info(
        `[MonthlyClose] Book "${book.name}" period already closed, skipping`,
      );

      results.push({
        bookId: book.id,
        bookName: book.name,
        year,
        month,
        status: "closed",
      });

      continue;
    }

    // Sync all active connected accounts for this book
    const connectedAccounts = await dbPool
      .select()
      .from(connectedAccountTable)
      .where(
        and(
          eq(connectedAccountTable.bookId, book.id),
          eq(connectedAccountTable.status, "active"),
        ),
      );

    for (const account of connectedAccounts) {
      if (!account.accessToken) {
        console.info(
          `[MonthlyClose] Skipping account ${account.id} (no access token)`,
        );
        continue;
      }

      try {
        await syncTransactions(account);
        console.info(
          `[MonthlyClose] Synced account ${account.id} (${account.institutionName})`,
        );
      } catch (err) {
        console.error(
          `[MonthlyClose] Failed to sync account ${account.id}:`,
          err,
        );
      }
    }

    // Check for pending review items in this period
    const pendingItems = await dbPool
      .select({ id: reconciliationQueueTable.id })
      .from(reconciliationQueueTable)
      .where(
        and(
          eq(reconciliationQueueTable.bookId, book.id),
          eq(reconciliationQueueTable.status, "pending_review"),
          eq(reconciliationQueueTable.periodYear, year),
          eq(reconciliationQueueTable.periodMonth, month),
        ),
      );

    if (pendingItems.length > 0) {
      // Period is blocked by pending review items
      const blockers = { pendingReviewCount: pendingItems.length };

      console.info(
        `[MonthlyClose] Book "${book.name}" blocked: ${blockers.pendingReviewCount} pending items`,
      );

      // Upsert accounting period as open with blockers
      if (existingPeriod) {
        await dbPool
          .update(accountingPeriodTable)
          .set({ status: "open", blockers })
          .where(eq(accountingPeriodTable.id, existingPeriod.id));
      } else {
        await dbPool.insert(accountingPeriodTable).values({
          bookId: book.id,
          year,
          month,
          status: "open",
          blockers,
        });
      }

      results.push({
        bookId: book.id,
        bookName: book.name,
        year,
        month,
        status: "blocked",
        blockers,
      });
    } else {
      // No blockers, close the period
      const closedAt = new Date().toISOString();

      if (existingPeriod) {
        await dbPool
          .update(accountingPeriodTable)
          .set({
            status: "closed",
            closedAt,
            closedBy: "system:monthly_close",
            blockers: null,
          })
          .where(eq(accountingPeriodTable.id, existingPeriod.id));
      } else {
        await dbPool.insert(accountingPeriodTable).values({
          bookId: book.id,
          year,
          month,
          status: "closed",
          closedAt,
          closedBy: "system:monthly_close",
        });
      }

      // Snapshot net worth at close
      try {
        await saveNetWorthSnapshot({ bookId: book.id });
        console.info(
          `[MonthlyClose] Net worth snapshot saved for book "${book.name}"`,
        );
      } catch (err) {
        console.error(
          `[MonthlyClose] Failed to save net worth snapshot for book "${book.name}":`,
          err,
        );
      }

      console.info(`[MonthlyClose] Book "${book.name}" period closed`);

      results.push({
        bookId: book.id,
        bookName: book.name,
        year,
        month,
        status: "closed",
      });
    }
  }

  console.info(
    `[MonthlyClose] Complete. ${results.filter((r) => r.status === "closed").length} closed, ${results.filter((r) => r.status === "blocked").length} blocked`,
  );

  return results;
};

export default runMonthlyClose;
