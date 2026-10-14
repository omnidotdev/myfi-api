import { sql } from "drizzle-orm";

import { journalEntryTable } from "lib/db/schema";

/**
 * Calendar-date filters for a journal entry's `date` column.
 *
 * `date` is a `timestamptz`, but reports filter by calendar day. Comparing the
 * raw column to a bare `YYYY-MM-DD` bound treats that bound as midnight, so an
 * entry carrying any time-of-day on the last day of a range sorts after the
 * bound and silently drops out of the period. Casting the column to `date`
 * (in the API session's timezone, which is the same context the write path
 * stores dates in) makes every comparison purely by calendar day.
 */
export const entryDateBetween = (startDate: string, endDate: string) =>
  sql`${journalEntryTable.date}::date between ${startDate} and ${endDate}`;

/** Inclusive upper bound by calendar day (as-of reports) */
export const entryDateOnOrBefore = (asOfDate: string) =>
  sql`${journalEntryTable.date}::date <= ${asOfDate}`;

/** Exclusive upper bound by calendar day (opening/beginning balances) */
export const entryDateBefore = (date: string) =>
  sql`${journalEntryTable.date}::date < ${date}`;
