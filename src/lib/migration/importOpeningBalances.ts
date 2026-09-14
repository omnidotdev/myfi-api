import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { journalEntryTable, journalLineTable } from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking the migrated opening-balance entry */
const OPENING_BALANCE_SOURCE = "quickbooks_opening_balance";
/** Stable reference id: exactly one opening-balance entry exists per book */
const OPENING_BALANCE_REF = "opening-balance";

// Money is compared as integer ten-thousandths (matching the numeric(19,4)
// columns and the .toFixed(4) writes), so the balance check is exact
const MONEY_SCALE = 10000;

interface OpeningBalanceLine {
  accountId: string;
  debit: number;
  credit: number;
  /** Account name, used only for the line memo */
  name?: string | null;
}

interface ImportOpeningBalancesOptions {
  bookId: string;
  /** As-of date the opening entry is stamped with (ISO date or timestamp) */
  asOf: string;
  lines: OpeningBalanceLine[];
}

interface ImportOpeningBalancesResult {
  entryId: string;
  lineCount: number;
  /** True when a prior opening-balance entry was removed and replaced */
  replaced: boolean;
}

/**
 * Import a QuickBooks trial balance as a single balanced "Opening Balances"
 * journal entry, dated the cutover.
 *
 * Reproducible by design: there is exactly one opening-balance entry per book,
 * so a re-import (e.g. when the cutover date slips) deletes the prior one and
 * writes the fresh balances in the same transaction, rather than stacking a
 * second entry. Balance is verified in integer ten-thousandths with exact
 * equality before anything is written, so an unbalanced trial balance is
 * rejected up front.
 */
const importOpeningBalances = async (
  opts: ImportOpeningBalancesOptions,
): Promise<ImportOpeningBalancesResult> => {
  const { bookId, asOf, lines } = opts;

  if (lines.length === 0) {
    throw new Error("Opening balance has no account lines");
  }

  let debitUnits = 0;
  let creditUnits = 0;
  for (const line of lines) {
    debitUnits += Math.round(line.debit * MONEY_SCALE);
    creditUnits += Math.round(line.credit * MONEY_SCALE);
  }

  if (debitUnits !== creditUnits) {
    throw new Error("Opening balance trial balance does not balance");
  }

  return dbPool.transaction(async (tx) => {
    // Replace any existing opening-balance entry for this book. Lines cascade on
    // the entry's delete (journal_line FK is onDelete cascade)
    const deleted = await tx
      .delete(journalEntryTable)
      .where(
        and(
          eq(journalEntryTable.bookId, bookId),
          eq(journalEntryTable.source, OPENING_BALANCE_SOURCE),
        ),
      )
      .returning({ id: journalEntryTable.id });

    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: asOf,
        memo: "Opening balances (migrated from QuickBooks)",
        source: OPENING_BALANCE_SOURCE,
        sourceReferenceId: OPENING_BALANCE_REF,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    if (!entryRow) {
      throw new Error("Failed to write the opening-balance entry");
    }

    for (const line of lines) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: line.accountId,
        debit: line.debit.toFixed(4),
        credit: line.credit.toFixed(4),
        memo: line.name ?? null,
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    return {
      entryId: entryRow.id,
      lineCount: lines.length,
      replaced: deleted.length > 0,
    };
  });
};

export { importOpeningBalances };
export type { OpeningBalanceLine };
