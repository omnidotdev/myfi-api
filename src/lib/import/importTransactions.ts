import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { journalEntryTable } from "lib/db/schema";
import { processTransaction } from "./processTransaction";

import type { InsertJournalEntry } from "lib/db/schema";

type ParsedTransaction = {
  date: string;
  amount: number;
  memo: string;
  merchantName?: string | null;
  referenceId?: string | null;
};

type ImportOptions = {
  bookId: string;
  source: NonNullable<InsertJournalEntry["source"]>;
  transactions: ParsedTransaction[];
};

type ImportResult = {
  addedCount: number;
  skippedCount: number;
};

/**
 * Generate a deterministic hash for CSV deduplication.
 * Uses date + amount + normalized memo as the composite key
 */
const hashTransaction = (
  date: string,
  amount: number,
  memo: string,
): string => {
  const normalized = `${date}|${amount}|${memo.toLowerCase().trim()}`;
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(normalized);

  return hasher.digest("hex").slice(0, 16);
};

/**
 * Import parsed transactions into the ledger.
 * Runs each transaction through the categorization pipeline (rules + LLM).
 * Uncategorized transactions are always created and queued for review.
 * Deduplicates via sourceReferenceId when provided, hash-based for CSV
 */
const importTransactions = async (
  options: ImportOptions,
): Promise<ImportResult> => {
  const { bookId, source, transactions } = options;
  let addedCount = 0;
  let skippedCount = 0;

  for (const txn of transactions) {
    // Deduplicate by referenceId
    if (txn.referenceId) {
      const [existing] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(
          and(
            eq(journalEntryTable.bookId, bookId),
            eq(journalEntryTable.source, source),
            eq(journalEntryTable.sourceReferenceId, txn.referenceId),
          ),
        );

      if (existing) {
        skippedCount++;
        continue;
      }
    }

    // Hash-based dedup for transactions without referenceId (CSV)
    if (!txn.referenceId) {
      const hash = hashTransaction(txn.date, txn.amount, txn.memo);
      const [existing] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(
          and(
            eq(journalEntryTable.bookId, bookId),
            eq(journalEntryTable.source, source),
            eq(journalEntryTable.sourceReferenceId, `hash:${hash}`),
          ),
        );

      if (existing) {
        skippedCount++;
        continue;
      }

      txn.referenceId = `hash:${hash}`;
    }

    await processTransaction(txn, { bookId, source });
    addedCount++;
  }

  return { addedCount, skippedCount };
};

export { hashTransaction, importTransactions };

export type { ParsedTransaction };
