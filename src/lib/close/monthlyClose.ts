import { and, eq, sql } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountingPeriodTable,
  bookTable,
  connectedAccountTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { postDepreciation } from "lib/depreciation";
import { saveNetWorthSnapshot } from "lib/netWorth/netWorthService";
import syncTransactions from "lib/plaid/syncTransactions";
import { notifications } from "lib/providers";

type CloseResult = {
  bookId: string;
  bookName: string;
  year: number;
  month: number;
  status: "closed" | "blocked";
  blockers?: { pendingReviewCount: number; trialBalanceOff?: boolean };
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

    // Post depreciation entries for the period
    try {
      const depResult = await postDepreciation(book.id, year, month);
      if (depResult.postedCount > 0) {
        console.info(
          `[MonthlyClose] Posted ${depResult.postedCount} depreciation entries for "${book.name}"`,
        );
      }
    } catch (err) {
      console.error(
        `[MonthlyClose] Failed to post depreciation for "${book.name}":`,
        err,
      );
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

    // Check trial balance (debits must equal credits)
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const [trialBalance] = await dbPool
      .select({
        totalDebits: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
        totalCredits: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .where(
        and(
          eq(journalEntryTable.bookId, book.id),
          sql`${journalEntryTable.date} >= ${startDate}`,
          sql`${journalEntryTable.date} < ${endDate}`,
        ),
      );

    const trialBalanceOff =
      trialBalance &&
      Math.abs(
        Number(trialBalance.totalDebits) - Number(trialBalance.totalCredits),
      ) > 0.005;

    if (pendingItems.length > 0 || trialBalanceOff) {
      // Period is blocked
      const blockers = {
        pendingReviewCount: pendingItems.length,
        ...(trialBalanceOff ? { trialBalanceOff: true } : {}),
      };

      const reasons = [];
      if (pendingItems.length > 0)
        reasons.push(`${pendingItems.length} pending items`);
      if (trialBalanceOff) reasons.push("trial balance out of balance");

      console.info(
        `[MonthlyClose] Book "${book.name}" blocked: ${reasons.join(", ")}`,
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

      emitAudit({
        type: "myfi.period.blocked",
        organizationId: book.organizationId,
        actor: SYSTEM_ACTOR,
        resource: { type: "accounting_period", id: "auto" },
        data: { year, month, bookName: book.name, blockers },
      });

      // Notify book owners/editors about the blocker
      notifyBlockedPeriod(book.name, year, month, blockers).catch((err) =>
        console.error(
          `[MonthlyClose] Failed to send blocker notification for "${book.name}":`,
          err,
        ),
      );

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

      emitAudit({
        type: "myfi.period.closed",
        organizationId: book.organizationId,
        actor: SYSTEM_ACTOR,
        resource: { type: "accounting_period", id: "auto" },
        data: {
          year,
          month,
          closedBy: "system:monthly_close",
          bookName: book.name,
        },
      });

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

/**
 * Send email notification when a period close is blocked.
 * Sends to all owners and editors of the book.
 */
const notifyBlockedPeriod = async (
  bookName: string,
  year: number,
  month: number,
  blockers: { pendingReviewCount: number; trialBalanceOff?: boolean },
) => {
  const periodLabel = `${new Date(year, month - 1).toLocaleString("en-US", { month: "long" })} ${year}`;

  const reasons: string[] = [];
  if (blockers.pendingReviewCount > 0) {
    reasons.push(
      `${blockers.pendingReviewCount} item${blockers.pendingReviewCount > 1 ? "s" : ""} pending review`,
    );
  }
  if (blockers.trialBalanceOff) {
    reasons.push("trial balance is out of balance");
  }

  const subject = `[MyFi] Monthly close blocked for "${bookName}" (${periodLabel})`;
  const body = [
    `The monthly close for "${bookName}" could not complete for ${periodLabel}.`,
    "",
    "Blocking issues:",
    ...reasons.map((r) => `  - ${r}`),
    "",
    "Please resolve these items and the next scheduled close will retry automatically.",
  ].join("\n");

  await notifications.sendEmail({
    to: "admin@omni.dev",
    subject,
    body,
  });
};

export default runMonthlyClose;
