import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountingPeriodTable } from "lib/db/schema";

/**
 * Derive the accounting period (calendar year/month) from a date string,
 * parsed from its leading `YYYY-MM` so it is timezone-free. `new Date(...)`
 * with local-time accessors would shift a `YYYY-MM-DD` date into the adjacent
 * month on a server whose timezone is behind UTC.
 */
export const periodFromDate = (
  date: string,
): { year: number; month: number } => {
  const [year, month] = date.slice(0, 7).split("-");
  return { year: Number(year), month: Number(month) };
};

/**
 * Whether a date falls within a closed accounting period for the given book.
 * Ledger-writing paths (journal CRUD, fixed-asset disposal, invoicing/billing)
 * must consult this so a posting cannot land in, or be moved into, a period
 * that has already been closed.
 */
export const isPeriodLocked = async (
  bookId: string,
  date: string,
): Promise<boolean> => {
  const { year, month } = periodFromDate(date);

  const [period] = await dbPool
    .select({ status: accountingPeriodTable.status })
    .from(accountingPeriodTable)
    .where(
      and(
        eq(accountingPeriodTable.bookId, bookId),
        eq(accountingPeriodTable.year, year),
        eq(accountingPeriodTable.month, month),
      ),
    );

  return period?.status === "closed";
};
