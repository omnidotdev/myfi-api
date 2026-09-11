import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountTable, quickbooksAccountMapTable } from "lib/db/schema";
import { queryAccounts } from "./quickbooksClient";

import type { InferInsertModel } from "drizzle-orm";
import type { QboAccount, QboTokens } from "./quickbooksClient";

/** A stored QuickBooks connection with its current OAuth tokens */
type QboConn = { realmId: string; accessToken: string; refreshToken: string };

/**
 * Outcome of a sync, partitioning every QBO account into exactly one bucket so
 * a caller can tell whether coverage is complete:
 *   mapped + alreadyMapped + unmatched.length === total QBO accounts
 */
type SyncAccountMapResult = {
  // QBO accounts newly inserted into the map this run
  mapped: number;
  // QBO accounts findMatch matched but that were already in the map (conflict-skipped)
  alreadyMapped: number;
  // QBO accounts findMatch could not confidently match this run
  unmatched: QboAccount[];
};

/** Only the MyFi account columns the auto-match reads */
type MyfiAccountRow = { id: string; code: string | null; name: string };

/** Normalize a name for a trimmed, case-insensitive comparison */
const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * Resolve the single MyFi account a QBO account maps to, or null when the
 * signal is absent or ambiguous.
 *
 * Conservative by design: a mis-map silently corrupts the ledger during
 * backfill, so a match is returned ONLY when a strong signal points to exactly
 * one MyFi account. Zero or multiple candidates always yield null, leaving the
 * account for a human to resolve in the Phase 2 UI.
 *
 * QBO AccountType strings do not line up with MyFi's type values, so type is
 * never used to match here, only the account number and the name.
 *
 * Strong match B (name) is the fallback for every case where A did not produce
 * a single match: not only when AcctNum is ABSENT, but also when AcctNum is
 * present yet non-unique (0 or >1 MyFi accounts share that code)
 */
const findMatch = (
  qbo: QboAccount,
  accounts: readonly MyfiAccountRow[],
): string | null => {
  // Strong match A: an explicit account number that lands on exactly one code
  const acctNum = qbo.AcctNum?.trim();
  if (acctNum) {
    const byCode = accounts.filter((a) => a.code?.trim() === acctNum);
    const [only] = byCode;
    if (byCode.length === 1 && only) return only.id;
  }

  // Strong match B: a name that matches exactly one account, case-insensitively.
  // An empty/whitespace-only QBO name is not a signal, so never match on it (it
  // would otherwise collide with a whitespace-only MyFi name)
  const name = normalizeName(qbo.Name);
  if (name === "") return null;
  const byName = accounts.filter((a) => normalizeName(a.name) === name);
  const [onlyByName] = byName;
  if (byName.length === 1 && onlyByName) return onlyByName.id;

  return null;
};

/**
 * Pull the QuickBooks chart of accounts and auto-map each QBO account to an
 * existing MyFi ledger account, persisting the mapping.
 *
 * Matching is intentionally conservative (see findMatch): an account is mapped
 * only on a unique account-number or unique name signal, otherwise it is left
 * unmatched for a human to resolve. The QBO AccountType is stored on every
 * mapped row so the Phase 2 UI can help resolve the unmatched ones.
 *
 * The upsert uses onConflictDoNothing on the (bookId, qboAccountId) unique
 * index: a re-run inserts nothing for an already-mapped account, so it never
 * duplicates AND never overwrites an existing mapping, including one a human
 * resolved manually. `mapped` counts rows newly written by this run, and a
 * matched account that was conflict-skipped falls into `alreadyMapped` so the
 * three buckets still account for every QBO account
 */
const syncAccountMap = async (opts: {
  bookId: string;
  conn: QboConn;
  onRefresh: (t: QboTokens) => Promise<void>;
}): Promise<SyncAccountMapResult> => {
  const { bookId, conn, onRefresh } = opts;

  const qboAccounts = await queryAccounts(conn, onRefresh);

  const accounts = await dbPool
    .select({
      id: accountTable.id,
      code: accountTable.code,
      name: accountTable.name,
    })
    .from(accountTable)
    .where(eq(accountTable.bookId, bookId));

  const unmatched: QboAccount[] = [];
  const rows: InferInsertModel<typeof quickbooksAccountMapTable>[] = [];

  for (const qbo of qboAccounts) {
    const myfiAccountId = findMatch(qbo, accounts);
    if (!myfiAccountId) {
      unmatched.push(qbo);
      continue;
    }

    rows.push({
      bookId,
      qboAccountId: qbo.Id,
      qboAccountName: qbo.Name,
      qboAccountType: qbo.AccountType,
      myfiAccountId,
    });
  }

  if (rows.length === 0) {
    return { mapped: 0, alreadyMapped: 0, unmatched };
  }

  const inserted = await dbPool
    .insert(quickbooksAccountMapTable)
    .values(rows)
    .onConflictDoNothing({
      target: [
        quickbooksAccountMapTable.bookId,
        quickbooksAccountMapTable.qboAccountId,
      ],
    })
    .returning();

  // Rows that matched but were not returned hit the unique-index conflict, so
  // they were already mapped by a prior run
  const mapped = inserted.length;
  return { mapped, alreadyMapped: rows.length - mapped, unmatched };
};

export { syncAccountMap };
