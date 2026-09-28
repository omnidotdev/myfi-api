import { and, eq, sql } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { buildYearEndCloseLines } from "lib/close/buildYearEndCloseLines";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  accountingPeriodTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { validateJournalLines } from "lib/journal/validateEntry";

type YearEndResult =
  | {
      bookId: string;
      year: number;
      status: "closed";
      netIncome: number;
    }
  | { status: "blocked"; reason: string }
  | { status: "already_closed" };

/**
 * Run year-end closing entries for a book.
 * Zeroes out revenue and expense accounts and posts the
 * net difference to retained earnings.
 */
const runYearEndClose = async (params: {
  bookId: string;
  year: number;
}): Promise<YearEndResult> => {
  const { bookId, year } = params;

  // Look up the book
  const [book] = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.id, bookId));

  if (!book) {
    return { status: "blocked", reason: "Book not found" };
  }

  const { fiscalYearStartMonth, organizationId } = book;

  // Verify all 12 monthly periods are closed
  const periods = await dbPool
    .select()
    .from(accountingPeriodTable)
    .where(
      and(
        eq(accountingPeriodTable.bookId, bookId),
        eq(accountingPeriodTable.year, year),
      ),
    );

  const closedPeriods = periods.filter((p) => p.status === "closed");

  if (closedPeriods.length < 12) {
    return {
      status: "blocked",
      reason: `Only ${closedPeriods.length} of 12 periods are closed`,
    };
  }

  // Check for existing year-end close entry
  const sourceRefId = `year_end_close:${year}`;
  const [existing] = await dbPool
    .select()
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalEntryTable.source, "year_end_close"),
        eq(journalEntryTable.sourceReferenceId, sourceRefId),
      ),
    );

  if (existing) {
    return { status: "already_closed" };
  }

  // Calculate fiscal year date range
  const fyStart =
    fiscalYearStartMonth === 1
      ? `${year}-01-01`
      : `${year - 1}-${String(fiscalYearStartMonth).padStart(2, "0")}-01`;

  const fyEndMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;
  const fyEndYear = fiscalYearStartMonth === 1 ? year : year;
  const fyLastDay = new Date(fyEndYear, fyEndMonth, 0).getDate();
  const fyEnd = `${fyEndYear}-${String(fyEndMonth).padStart(2, "0")}-${String(fyLastDay).padStart(2, "0")}`;

  // Query revenue account balances (credit - debit)
  const revenueBalances = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      balance: sql<string>`coalesce(sum(${journalLineTable.credit}) - sum(${journalLineTable.debit}), 0)`,
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
        eq(accountTable.type, "revenue"),
        sql`${journalEntryTable.date} >= ${fyStart}`,
        sql`${journalEntryTable.date} <= ${fyEnd}`,
      ),
    )
    .groupBy(journalLineTable.accountId);

  // Query expense account balances (debit - credit)
  const expenseBalances = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      balance: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
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
        eq(accountTable.type, "expense"),
        sql`${journalEntryTable.date} >= ${fyStart}`,
        sql`${journalEntryTable.date} <= ${fyEnd}`,
      ),
    )
    .groupBy(journalLineTable.accountId);

  // Find or create retained earnings account
  const [retainedEarnings] = await dbPool
    .select()
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, "retained_earnings"),
      ),
    );

  let retainedEarningsId: string;

  if (retainedEarnings) {
    retainedEarningsId = retainedEarnings.id;
  } else {
    await dbPool.insert(accountTable).values({
      bookId,
      name: "Retained Earnings",
      type: "equity",
      subType: "retained_earnings",
      code: "3100",
    });

    // Fetch the newly created account
    const [created] = await dbPool
      .select()
      .from(accountTable)
      .where(
        and(
          eq(accountTable.bookId, bookId),
          eq(accountTable.subType, "retained_earnings"),
        ),
      );

    retainedEarningsId = created!.id;
  }

  // Build the balanced closing lines (each account closed in the direction that
  // zeroes its signed balance, so contra balances don't unbalance the entry)
  const { lines, netIncome } = buildYearEndCloseLines({
    revenueBalances,
    expenseBalances,
    retainedEarningsId,
  });

  // Post the header and its lines atomically, so a mid-write failure can't leave
  // an orphan closing entry that the idempotency check then treats as done
  await dbPool.transaction(async (tx) => {
    const [closingEntry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: fyEnd,
        memo: `Year-end closing entry for fiscal year ${year}`,
        source: "year_end_close",
        sourceReferenceId: sourceRefId,
        isReviewed: true,
        isReconciled: true,
      })
      .returning();

    if (!closingEntry) throw new Error("Failed to write the closing entry");

    if (lines.length > 0) {
      const entryLines = lines.map((line) => ({
        journalEntryId: closingEntry.id,
        ...line,
      }));
      validateJournalLines(entryLines);
      await tx.insert(journalLineTable).values(entryLines);
    }
  });

  emitAudit({
    type: "myfi.year_end.closed",
    organizationId,
    actor: SYSTEM_ACTOR,
    resource: { type: "book", id: bookId },
    data: { year, netIncome },
  });

  return { bookId, year, status: "closed", netIncome };
};

export default runYearEndClose;
