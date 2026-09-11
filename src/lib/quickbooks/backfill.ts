import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  connectedAccountTable,
  quickbooksAccountMapTable,
  quickbooksMigrationTable,
} from "lib/db/schema";
import { decryptToken, encryptToken } from "lib/encryption/tokenEncryption";
import { importJournalEntries } from "./importJournalEntries";
import { syncAccountMap } from "./mapAccounts";
import { queryJournalEntries, queryPreferences } from "./quickbooksClient";

import type { QboEntryInput, QboLine } from "./importJournalEntries";
import type {
  QboConnection,
  QboJournalEntry,
  QboTokens,
} from "./quickbooksClient";

/**
 * Oldest date the backfill will reach when a migration has no explicit start.
 * Phase-1 limitation: company inception is not derived, so history before this
 * floor is truncated rather than pulled from the company's actual open date
 */
const FLOOR_DATE = "2015-01-01";

/** Cap on unmatched account names listed in the needs-mapping summary */
const MAX_LISTED_UNMATCHED = 20;

/**
 * Normalize a stored timestamp (or plain date) to a YYYY-MM-DD UTC calendar
 * date, which is the only shape the QBO query client accepts
 */
const toIsoDate = (value: string): string =>
  new Date(value).toISOString().slice(0, 10);

/** Today as a YYYY-MM-DD UTC calendar date */
const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

/**
 * Split an inclusive [start, end] range into calendar-month windows.
 *
 * Chunking keeps every JournalEntry report query well under QBO's 400k-cell
 * cap and bounds each request, so a multi-year backfill never issues one
 * unbounded query. The trailing window is clamped to end, so it may be a
 * partial month
 */
const monthlyWindows = (
  start: string,
  end: string,
): Array<{ start: string; end: string }> => {
  const windows: Array<{ start: string; end: string }> = [];
  const endDate = new Date(`${end}T00:00:00.000Z`);
  let cursor = new Date(`${start}T00:00:00.000Z`);

  while (cursor <= endDate) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    // Day 0 of the next month resolves to the last day of this month
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const windowEnd = monthEnd < endDate ? monthEnd : endDate;
    windows.push({
      start: cursor.toISOString().slice(0, 10),
      end: windowEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }

  return windows;
};

/**
 * Map a QBO journal entry to the ledger import shape.
 *
 * Non-posting lines (no JournalEntryLineDetail) carry no account or posting
 * side, so they are skipped rather than imported. A Debit line becomes
 * { debit: Amount, credit: 0 } and a Credit line the mirror, preserving the
 * double-entry sides verbatim
 */
const mapEntry = (entry: QboJournalEntry): QboEntryInput => {
  const lines: QboLine[] = [];

  for (const line of entry.Line) {
    const detail = line.JournalEntryLineDetail;
    if (!detail) continue;

    const isDebit = detail.PostingType === "Debit";
    lines.push({
      qboAccountId: detail.AccountRef.value,
      debit: isDebit ? line.Amount : 0,
      credit: isDebit ? 0 : line.Amount,
      memo: line.Description ?? null,
    });
  }

  return {
    qboEntryId: entry.Id,
    date: entry.TxnDate,
    memo: entry.PrivateNote ?? null,
    lines,
  };
};

/**
 * Backfill a book's ledger from a connected QuickBooks Online company.
 *
 * Pulls JournalEntry rows month by month across the migration's period,
 * mapping each to a MyFi journal entry and importing it, tracking rolling
 * progress on the migration row. On any failure the migration is marked failed
 * with a generic message (never a token, secret, or raw QBO body) and the
 * error is rethrown for the caller to log
 */
export const runBackfill = async (opts: {
  migrationId: string;
  bookId: string;
  connectedAccountId: string;
}): Promise<{ entriesImported: number }> => {
  const { migrationId, bookId, connectedAccountId } = opts;

  try {
    const [account] = await dbPool
      .select()
      .from(connectedAccountTable)
      .where(eq(connectedAccountTable.id, connectedAccountId));

    if (!account?.accessToken || !account.refreshToken || !account.realmId) {
      throw new Error("Connected account is missing QuickBooks credentials");
    }

    // Defense-in-depth against a cross-tenant import: the connected account
    // must belong to the book being backfilled. The route enforces this too,
    // but runBackfill must be safe regardless of how it is called
    if (account.bookId !== bookId) {
      throw new Error("Connected account does not belong to this book");
    }

    const conn: QboConnection = {
      realmId: account.realmId,
      accessToken: decryptToken(account.accessToken),
      refreshToken: decryptToken(account.refreshToken),
    };

    // Persist rotated tokens AND update the in-memory connection, so later
    // windows use the current tokens and the next refresh rotates from the
    // latest refresh token rather than the original (rotated-away) one
    const onRefresh = async (tokens: QboTokens): Promise<void> => {
      conn.accessToken = tokens.accessToken;
      conn.refreshToken = tokens.refreshToken;
      await dbPool
        .update(connectedAccountTable)
        .set({
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: encryptToken(tokens.refreshToken),
        })
        .where(eq(connectedAccountTable.id, connectedAccountId));
    };

    const [migration] = await dbPool
      .select()
      .from(quickbooksMigrationTable)
      .where(eq(quickbooksMigrationTable.id, migrationId));

    if (!migration) {
      throw new Error("QuickBooks migration not found");
    }

    await dbPool
      .update(quickbooksMigrationTable)
      .set({ status: "importing", updatedAt: new Date().toISOString() })
      .where(eq(quickbooksMigrationTable.id, migrationId));

    // Primary multi-currency guard: check the company Preferences up front, so
    // a multi-currency company is refused before ANY entry is imported (never a
    // partial import discovered only when a second currency appears mid-range)
    const preferences = await queryPreferences(conn, onRefresh);
    if (preferences?.CurrencyPrefs?.MultiCurrencyEnabled === true) {
      throw new Error(
        "Multi-currency QuickBooks companies are not yet supported",
      );
    }

    // Refresh the QBO->MyFi account map before importing, so entries resolve
    // against the current chart of accounts. Conservative auto-matching leaves
    // ambiguous accounts unmapped for a human to resolve (see mapAccounts)
    const { unmatched } = await syncAccountMap({ bookId, conn, onRefresh });

    // Phase 1 has no mapping-resolution UI, so any unmatched account is a hard
    // precondition: an entry referencing an unmapped account would abort the
    // whole import opaquely. Stop here with an actionable status listing the
    // unmatched QBO account names (the owner's own data, not secrets) so a
    // human can resolve them before retrying
    if (unmatched.length > 0) {
      const names = unmatched.map((account) => account.Name);
      const shown = names.slice(0, MAX_LISTED_UNMATCHED);
      const remainder = names.length - shown.length;
      const summary =
        remainder > 0
          ? `${shown.join(", ")} and ${remainder} more`
          : shown.join(", ");

      await dbPool
        .update(quickbooksMigrationTable)
        .set({
          status: "needs_mapping",
          errorMessage: `Unmapped QuickBooks accounts need manual mapping before import: ${summary}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(quickbooksMigrationTable.id, migrationId));

      return { entriesImported: 0 };
    }

    const mapRows = await dbPool
      .select()
      .from(quickbooksAccountMapTable)
      .where(eq(quickbooksAccountMapTable.bookId, bookId));

    const accountMap = new Map<string, string>(
      mapRows.map((row) => [row.qboAccountId, row.myfiAccountId]),
    );

    const start = migration.periodStart
      ? toIsoDate(migration.periodStart)
      : FLOOR_DATE;
    const end = migration.periodEnd
      ? toIsoDate(migration.periodEnd)
      : todayIsoDate();

    if (start > end) {
      throw new Error("Invalid backfill date range");
    }

    // Defense-in-depth behind the Preferences check: distinct non-empty
    // currencies seen across entries. QBO reports amounts in each entry's own
    // currency, so more than one would import unconvertible amounts into a
    // single-currency ledger
    const currencies = new Set<string>();
    let total = 0;

    for (const chunk of monthlyWindows(start, end)) {
      const qboEntries = await queryJournalEntries(conn, {
        start: chunk.start,
        end: chunk.end,
        onRefresh,
      });

      for (const qboEntry of qboEntries) {
        const currency = qboEntry.CurrencyRef?.value;
        if (currency) currencies.add(currency);
      }
      if (currencies.size > 1) {
        throw new Error(
          "Multi-currency QuickBooks companies are not yet supported",
        );
      }

      const entries = qboEntries.map(mapEntry);
      const { addedCount, skippedCount } = await importJournalEntries({
        bookId,
        accountMap,
        entries,
      });
      // Count entries now in the ledger for this migration (new inserts plus
      // ones already present from a prior run), so progress reflects the ledger
      // rather than only this run's fresh inserts
      total += addedCount + skippedCount;

      await dbPool
        .update(quickbooksMigrationTable)
        .set({ entriesImported: total, updatedAt: new Date().toISOString() })
        .where(eq(quickbooksMigrationTable.id, migrationId));
    }

    await dbPool
      .update(quickbooksMigrationTable)
      .set({
        status: "complete",
        entriesImported: total,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quickbooksMigrationTable.id, migrationId));

    return { entriesImported: total };
  } catch (error) {
    // Record only a generic message plus the error class, never a token,
    // secret, or raw QBO response body
    const name = error instanceof Error ? error.name : "Error";
    await dbPool
      .update(quickbooksMigrationTable)
      .set({
        status: "failed",
        errorMessage: `QuickBooks backfill failed (${name})`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quickbooksMigrationTable.id, migrationId));

    throw error;
  }
};
