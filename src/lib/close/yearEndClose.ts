import { and, eq, sql } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  accountingPeriodTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

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

  // Calculate totals
  const totalRevenue = revenueBalances.reduce(
    (sum, r) => sum + Number(r.balance),
    0,
  );
  const totalExpenses = expenseBalances.reduce(
    (sum, r) => sum + Number(r.balance),
    0,
  );
  const netIncome = totalRevenue - totalExpenses;

  // Post the closing journal entry
  await dbPool.insert(journalEntryTable).values({
    bookId,
    date: fyEnd,
    memo: `Year-end closing entry for fiscal year ${year}`,
    source: "year_end_close",
    sourceReferenceId: sourceRefId,
    isReviewed: true,
    isReconciled: true,
  });

  // Fetch the created entry
  const [closingEntry] = await dbPool
    .select()
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalEntryTable.sourceReferenceId, sourceRefId),
      ),
    );

  const lines: Array<{
    journalEntryId: string;
    accountId: string;
    debit: string;
    credit: string;
    memo: string;
  }> = [];

  // Debit each revenue account to zero it
  for (const rev of revenueBalances) {
    const bal = Number(rev.balance);
    if (Math.abs(bal) < 0.005) continue;

    lines.push({
      journalEntryId: closingEntry!.id,
      accountId: rev.accountId,
      debit: Math.abs(bal).toFixed(4),
      credit: "0.0000",
      memo: "Close revenue to retained earnings",
    });
  }

  // Credit each expense account to zero it
  for (const exp of expenseBalances) {
    const bal = Number(exp.balance);
    if (Math.abs(bal) < 0.005) continue;

    lines.push({
      journalEntryId: closingEntry!.id,
      accountId: exp.accountId,
      debit: "0.0000",
      credit: Math.abs(bal).toFixed(4),
      memo: "Close expense to retained earnings",
    });
  }

  // Net difference to retained earnings
  if (Math.abs(netIncome) >= 0.005) {
    if (netIncome > 0) {
      // Net income: credit retained earnings
      lines.push({
        journalEntryId: closingEntry!.id,
        accountId: retainedEarningsId,
        debit: "0.0000",
        credit: netIncome.toFixed(4),
        memo: "Net income to retained earnings",
      });
    } else {
      // Net loss: debit retained earnings
      lines.push({
        journalEntryId: closingEntry!.id,
        accountId: retainedEarningsId,
        debit: Math.abs(netIncome).toFixed(4),
        credit: "0.0000",
        memo: "Net loss to retained earnings",
      });
    }
  }

  if (lines.length > 0) {
    await dbPool.insert(journalLineTable).values(lines);
  }

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
