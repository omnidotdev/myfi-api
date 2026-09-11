import { and, eq, gt } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  connectedAccountTable,
  journalEntryTable,
  quickbooksCutoverTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";
import { revokeToken } from "./quickbooksClient";

/**
 * Thrown when a cutover is attempted on a book that has not reconciled cleanly.
 * The route maps this to a 409, distinguishing a blocked gate from a generic
 * failure. Its message is a fixed, safe string carrying no book data
 */
export class CutoverNotReconciledError extends Error {}

/**
 * Cut a book over from QuickBooks to MyFi as the system of record.
 *
 * Gated on a clean tie-out: the referenced reconciliation run must be complete
 * with zero mismatches, otherwise nothing is written and a
 * CutoverNotReconciledError is thrown. On a clean book the cutover row and the
 * connection disconnect are committed atomically, then the QBO refresh token is
 * revoked on a best-effort basis after the commit, so a revoke failure can
 * never roll back the local cutover. Idempotent: a second call for a book that
 * has already cut over is a no-op that returns the existing cutover id
 */
export const runCutover = async (opts: {
  bookId: string;
  connectedAccountId: string;
  reconciliationId: string;
}): Promise<{ cutoverId: string; alreadyCutOver: boolean }> => {
  const { bookId, connectedAccountId, reconciliationId } = opts;

  const [account] = await dbPool
    .select()
    .from(connectedAccountTable)
    .where(eq(connectedAccountTable.id, connectedAccountId));

  if (!account) {
    throw new Error("Connected account not found");
  }

  // Defense-in-depth against a cross-tenant cutover: the connected account must
  // belong to the book being cut over. The route enforces this too, but
  // runCutover must be safe regardless of how it is called
  if (account.bookId !== bookId) {
    throw new Error("Connected account does not belong to this book");
  }

  if (account.provider !== "quickbooks") {
    throw new Error("Connected account is not a QuickBooks connection");
  }

  const [recon] = await dbPool
    .select()
    .from(quickbooksReconciliationTable)
    .where(eq(quickbooksReconciliationTable.id, reconciliationId));

  if (!recon) {
    throw new Error("QuickBooks reconciliation run not found");
  }

  // The reconciliation run must be for this same book and connection, so a
  // clean tie-out from an unrelated book can never authorize this cutover
  if (
    recon.bookId !== bookId ||
    recon.connectedAccountId !== connectedAccountId
  ) {
    throw new Error("Reconciliation run does not match this cutover");
  }

  // Tie-out gate: the safety boundary. No cutover is permitted unless the run
  // completed with zero mismatches. Nothing is written when the gate fails
  if (recon.status !== "complete" || Number(recon.mismatchCount) !== 0) {
    throw new CutoverNotReconciledError("Book has not reconciled cleanly");
  }

  // Freshness guard: a clean tie-out only authorizes a cutover while the MyFi
  // ledger is unchanged since it was verified. A book can drift after
  // reconciling (a later QBO backfill, a manual journal entry, a Plaid import),
  // and the stale reconciliationId would otherwise still pass the gate above.
  // recon.updatedAt is the completion timestamp (reconcile sets status running
  // then complete, touching updatedAt), so any journal entry created after it
  // means the book no longer ties out. Bounded existence check: select a single
  // id, never the whole ledger. Nothing is written when this gate fails.
  // A complete run always carries a completion timestamp (updatedAt defaults to
  // now and reconcile updates it), so a missing one is a corrupt state we
  // cannot prove freshness against: fail closed rather than authorize a cutover
  if (!recon.updatedAt) {
    throw new CutoverNotReconciledError("Book changed since reconciliation");
  }

  const [changedEntry] = await dbPool
    .select({ id: journalEntryTable.id })
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        gt(journalEntryTable.createdAt, recon.updatedAt),
      ),
    )
    .limit(1);

  if (changedEntry) {
    throw new CutoverNotReconciledError("Book changed since reconciliation");
  }

  // Insert the cutover row and disconnect the connection atomically. The unique
  // index on book id makes onConflictDoNothing race-safe and idempotent: a book
  // already cut over inserts nothing and returns no row
  const { cutoverId, alreadyCutOver } = await dbPool.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(quickbooksCutoverTable)
      .values({ bookId, connectedAccountId, reconciliationId })
      .onConflictDoNothing({ target: [quickbooksCutoverTable.bookId] })
      .returning();

    if (!inserted) {
      // Already cut over (a prior run or a concurrent insert won the race): do
      // not disconnect again or revoke, just return the existing cutover id
      const [existing] = await tx
        .select()
        .from(quickbooksCutoverTable)
        .where(eq(quickbooksCutoverTable.bookId, bookId));

      // A conflict means a cutover row exists, so a missing one here is an
      // impossible state. Fail loudly rather than returning a blank id
      if (!existing) {
        throw new Error("Cutover conflict but no existing row found");
      }

      return { cutoverId: existing.id, alreadyCutOver: true };
    }

    // Clear the stored credentials alongside the disconnect, so if the
    // post-commit revoke later fails MyFi never retains a live QBO credential
    // for an account it now treats as disconnected. The revoke below reads the
    // in-memory refresh token captured before this update, not the DB row, so
    // nulling the columns here does not break it
    await tx
      .update(connectedAccountTable)
      .set({ status: "disconnected", accessToken: null, refreshToken: null })
      .where(eq(connectedAccountTable.id, connectedAccountId));

    return { cutoverId: inserted.id, alreadyCutOver: false };
  });

  // Best-effort revoke AFTER the transaction commits, so a revoke failure can
  // never roll back the committed local cutover and disconnect (the local
  // disconnect is the source of truth). Only revoke on a fresh cutover
  if (!alreadyCutOver && account.refreshToken) {
    try {
      await revokeToken(decryptToken(account.refreshToken));
    } catch (error) {
      // Log only the error class server-side, never the token or a raw body
      const name = error instanceof Error ? error.name : "Error";
      console.error(`[QuickBooks] token revoke failed (${name})`);
    }
  }

  return { cutoverId, alreadyCutOver };
};
