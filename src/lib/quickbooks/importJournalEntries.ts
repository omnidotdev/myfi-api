import { dbPool } from "lib/db/db";
import { journalEntryTable, journalLineTable } from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

type QboLine = {
  qboAccountId: string;
  debit: number;
  credit: number;
  memo?: string | null;
};

type QboEntryInput = {
  qboEntryId: string;
  date: string;
  memo?: string | null;
  lines: QboLine[];
};

type ImportJournalEntriesOptions = {
  bookId: string;
  // qboAccountId -> myfiAccountId
  accountMap: Map<string, string>;
  entries: QboEntryInput[];
};

type ImportJournalEntriesResult = {
  addedCount: number;
  skippedCount: number;
};

// A validated line carries the MyFi account id resolved from the map, so the
// write loop never re-looks-up or re-checks the mapping
type ResolvedLine = QboLine & { accountId: string };

// Scale of the numeric(19,4) money columns: amounts are compared as integer
// ten-thousandths so the balance check is exact, with no float epsilon
const MONEY_SCALE = 10000;

/**
 * Validate a single QBO entry and resolve each line's MyFi account.
 *
 * Every check here is systemic: an empty entry, an unmapped account, or an
 * out-of-balance entry means the migration input or setup is wrong, not that
 * one row is bad, so a failure throws to abort the whole batch before any write.
 *
 * Balance is checked in integer ten-thousandths (matching the numeric(19,4)
 * columns and the .toFixed(4) writes) with exact equality, so there is no float
 * epsilon and a genuine one-unit imbalance is rejected
 */
const validateEntry = (
  entry: QboEntryInput,
  accountMap: Map<string, string>,
): ResolvedLine[] => {
  // A header row with no lines would "balance" (0 === 0) yet post nothing, so
  // reject it rather than writing an empty entry
  if (entry.lines.length === 0) {
    throw new Error(`QuickBooks entry ${entry.qboEntryId} has no lines`);
  }

  const resolvedLines: ResolvedLine[] = [];
  let debitUnits = 0;
  let creditUnits = 0;

  for (const line of entry.lines) {
    // Every referenced account must map to a MyFi account
    const accountId = accountMap.get(line.qboAccountId);
    if (!accountId) {
      throw new Error(
        `No MyFi account mapped for QuickBooks account ${line.qboAccountId}`,
      );
    }

    debitUnits += Math.round(line.debit * MONEY_SCALE);
    creditUnits += Math.round(line.credit * MONEY_SCALE);
    resolvedLines.push({ ...line, accountId });
  }

  // Double-entry invariant: total debits must equal total credits, exactly
  if (debitUnits !== creditUnits) {
    throw new Error(`QuickBooks entry ${entry.qboEntryId} does not balance`);
  }

  return resolvedLines;
};

/**
 * Import QuickBooks Online journal entries into the MyFi ledger.
 *
 * QBO entries are already multi-line double-entry, so each line's debit and
 * credit are written verbatim (no sign inference or absolute value) rather than
 * mirroring a single bank amount the way processTransaction does.
 *
 * The whole batch is validated (non-empty + balance + account mapping) up front,
 * so if any entry is invalid nothing is written at all. This is NOT full-batch
 * atomicity: once validation passes, each entry is committed in its own
 * transaction, so a mid-batch failure (e.g. a DB error) can leave earlier
 * entries written. That partial progress is intentional and safe because a
 * re-run is idempotent: the (bookId, source, sourceReferenceId) unique index
 * plus onConflictDoNothing turns an already-written entry into a skip, never a
 * double-post
 */
const importJournalEntries = async (
  opts: ImportJournalEntriesOptions,
): Promise<ImportJournalEntriesResult> => {
  const { bookId, accountMap, entries } = opts;

  const validated = entries.map((entry) => ({
    entry,
    lines: validateEntry(entry, accountMap),
  }));

  let addedCount = 0;
  let skippedCount = 0;

  for (const { entry, lines } of validated) {
    // One transaction per entry so its lines are written atomically only after
    // the entry row is confirmed written
    const written = await dbPool.transaction(async (tx) => {
      // onConflictDoNothing on the (book, source, source_reference_id) unique
      // index makes a re-import of the same QBO entry a no-op: a duplicate
      // inserts nothing and returns no row, so we skip its lines rather than
      // double-posting, and it is race-safe against concurrent imports
      const [entryRow] = await tx
        .insert(journalEntryTable)
        .values({
          bookId,
          date: entry.date,
          memo: entry.memo ?? null,
          source: "quickbooks_import",
          sourceReferenceId: entry.qboEntryId,
        } satisfies InferInsertModel<typeof journalEntryTable>)
        .onConflictDoNothing({
          target: [
            journalEntryTable.bookId,
            journalEntryTable.source,
            journalEntryTable.sourceReferenceId,
          ],
        })
        .returning();

      // Already imported (a prior run or a concurrent insert won the race):
      // skip the lines so nothing is double-written
      if (!entryRow) return null;

      for (const line of lines) {
        await tx.insert(journalLineTable).values({
          journalEntryId: entryRow.id,
          accountId: line.accountId,
          debit: line.debit.toFixed(4),
          credit: line.credit.toFixed(4),
          memo: line.memo ?? null,
        } satisfies InferInsertModel<typeof journalLineTable>);
      }

      return entryRow;
    });

    if (written) {
      addedCount++;
    } else {
      skippedCount++;
    }
  }

  return { addedCount, skippedCount };
};

export { importJournalEntries };

export type { QboEntryInput, QboLine };
