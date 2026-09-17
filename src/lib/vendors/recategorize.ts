import { and, eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { journalEntryTable, journalLineTable } from "lib/db/schema";

type RecategorizeValidation = { ok: true } | { ok: false; error: string };

/**
 * Pure guard for a vendor bulk-recategorize request. Kept free of DB access so
 * it is unit-testable; the route resolves the booleans, then calls this
 */
export const validateRecategorize = (input: {
  fromAccountId: string;
  toAccountId: string;
  vendorInBook: boolean;
  fromAccountInBook: boolean;
  toAccountInBook: boolean;
}): RecategorizeValidation => {
  if (!input.vendorInBook) {
    return { ok: false, error: "Vendor not found in this book" };
  }
  if (!input.fromAccountId || !input.toAccountId) {
    return {
      ok: false,
      error: "Both a source and target account are required",
    };
  }
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: "Source and target accounts must be different" };
  }
  if (!input.fromAccountInBook) {
    return { ok: false, error: "Source account not found in this book" };
  }
  if (!input.toAccountInBook) {
    return { ok: false, error: "Target account not found in this book" };
  }

  return { ok: true };
};

type RecategorizeResult = {
  /** Editable (non-reconciled) lines that match, i.e. would change or changed */
  matched: number;
  /** Matching lines left untouched because their entry is reconciled (closed) */
  skippedReconciled: number;
  /** Lines actually updated (0 on a dry run) */
  updated: number;
};

/**
 * Reassign a vendor's journal lines from one account to another, book-scoped.
 *
 * Only lines on NON-reconciled entries are touched: a reconciled entry belongs
 * to a closed period, so bulk-recategorizing must never silently rewrite it.
 * Matching-but-reconciled lines are reported as skippedReconciled instead. A
 * dryRun resolves the counts without mutating, so the UI can confirm the exact
 * impact before the user commits
 */
export const recategorizeVendorLines = async (opts: {
  bookId: string;
  vendorId: string;
  fromAccountId: string;
  toAccountId: string;
  dryRun: boolean;
}): Promise<RecategorizeResult> => {
  const { bookId, vendorId, fromAccountId, toAccountId, dryRun } = opts;

  const candidates = await dbPool
    .select({
      lineId: journalLineTable.id,
      isReconciled: journalEntryTable.isReconciled,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        eq(journalEntryTable.vendorId, vendorId),
        eq(journalLineTable.accountId, fromAccountId),
      ),
    );

  const editable = candidates
    .filter((c) => !c.isReconciled)
    .map((c) => c.lineId);
  const skippedReconciled = candidates.length - editable.length;

  if (dryRun || editable.length === 0) {
    return { matched: editable.length, skippedReconciled, updated: 0 };
  }

  await dbPool
    .update(journalLineTable)
    .set({ accountId: toAccountId })
    .where(inArray(journalLineTable.id, editable));

  return {
    matched: editable.length,
    skippedReconciled,
    updated: editable.length,
  };
};
