import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";

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
 * Find the best account mapping for a transaction.
 * Priority: merchant → generic income/expense
 */
const findBestMapping = async (
  bookId: string,
  merchantName: string | null | undefined,
  isIncome: boolean,
) => {
  // 1. Try merchant-specific mapping
  if (merchantName) {
    const normalized = merchantName.toLowerCase().trim();
    const [merchantMapping] = await dbPool
      .select()
      .from(accountMappingTable)
      .where(
        and(
          eq(accountMappingTable.bookId, bookId),
          eq(accountMappingTable.eventType, `merchant:${normalized}`),
        ),
      );
    if (merchantMapping) return merchantMapping;
  }

  // 2. Fall back to generic income/expense
  const eventType = isIncome ? "plaid_income" : "plaid_expense";
  const [genericMapping] = await dbPool
    .select()
    .from(accountMappingTable)
    .where(
      and(
        eq(accountMappingTable.bookId, bookId),
        eq(accountMappingTable.eventType, eventType),
      ),
    );

  return genericMapping ?? null;
};

/**
 * Import parsed transactions into the ledger.
 * Creates journal entries, lines, and reconciliation queue entries.
 * Deduplicates via sourceReferenceId when provided.
 */
const importTransactions = async (
  options: ImportOptions,
): Promise<ImportResult> => {
  const { bookId, source, transactions } = options;
  let addedCount = 0;
  let skippedCount = 0;

  for (const txn of transactions) {
    // Deduplicate if referenceId is provided
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

    // For transactions without referenceId (e.g. CSV), use hash-based dedup
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

      // Store hash as sourceReferenceId for future dedup
      txn.referenceId = `hash:${hash}`;
    }

    const amount = Math.abs(txn.amount);
    const isIncome = txn.amount < 0;

    const mapping = await findBestMapping(bookId, txn.merchantName, isIncome);

    if (!mapping) {
      skippedCount++;
      continue;
    }

    const [entry] = await dbPool
      .insert(journalEntryTable)
      .values({
        bookId,
        date: txn.date,
        memo: txn.memo,
        source,
        sourceReferenceId: txn.referenceId ?? null,
        isReviewed: false,
        isReconciled: false,
      })
      .returning();

    await dbPool.insert(journalLineTable).values([
      {
        journalEntryId: entry.id,
        accountId: mapping.debitAccountId,
        debit: amount.toFixed(4),
        credit: "0.0000",
      },
      {
        journalEntryId: entry.id,
        accountId: mapping.creditAccountId,
        debit: "0.0000",
        credit: amount.toFixed(4),
      },
    ]);

    await dbPool.insert(reconciliationQueueTable).values({
      bookId,
      journalEntryId: entry.id,
      status: "pending_review",
    });

    addedCount++;
  }

  return { addedCount, skippedCount };
};

/**
 * Generate a deterministic hash for CSV deduplication.
 * Uses date + amount + normalized memo as the composite key.
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

export { hashTransaction, importTransactions };

export type { ParsedTransaction };
