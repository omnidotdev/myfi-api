import { eq } from "drizzle-orm";

import { AUTO_APPROVE_THRESHOLD, categorize } from "lib/categorization";
import { dbPool } from "lib/db/db";
import {
  bookTable,
  journalEntryTable,
  journalLineTable,
  journalLineTagTable,
  reconciliationQueueTable,
} from "lib/db/schema";

import type { InsertJournalEntry } from "lib/db/schema";

interface TransactionInput {
  date: string;
  amount: number;
  memo: string;
  merchantName?: string | null;
  referenceId?: string | null;
  plaidCategory?: string | null;
}

interface ProcessOptions {
  bookId: string;
  source: NonNullable<InsertJournalEntry["source"]>;
}

interface ProcessResult {
  entryId: string;
  status: string;
  priority: number;
  confidence: number;
}

/**
 * Process a single parsed transaction through the categorization pipeline.
 * Creates journal entry, lines (if categorized), and reconciliation queue entry.
 * Used by both Plaid sync and manual import paths
 */
const processTransaction = async (
  txn: TransactionInput,
  opts: ProcessOptions,
): Promise<ProcessResult> => {
  const { bookId, source } = opts;
  const amount = Math.abs(txn.amount);
  const txnDate = new Date(txn.date);

  // Fetch book type for categorization context
  const [book] = await dbPool
    .select({ type: bookTable.type })
    .from(bookTable)
    .where(eq(bookTable.id, bookId));

  if (!book) {
    throw new Error(`Book not found: ${bookId}`);
  }

  // Run categorization engine (rules, then LLM)
  let debitAccountId: string | null = null;
  let creditAccountId: string | null = null;
  let confidence = 0;
  let categorizationSource: string | null = null;
  let tagId: string | null = null;

  const catResult = await categorize(
    {
      merchantName: txn.merchantName ?? null,
      memo: txn.memo ?? null,
      plaidCategory: txn.plaidCategory ?? null,
      amount,
    },
    bookId,
    book.type,
  );

  if (catResult) {
    debitAccountId = catResult.debitAccountId;
    creditAccountId = catResult.creditAccountId;
    confidence = catResult.confidence;
    categorizationSource = catResult.source;
    tagId = catResult.tagId ?? null;
  }

  // Determine reconciliation status based on confidence
  const hasAccounts = debitAccountId && creditAccountId;

  let status: string;
  let priority: number;
  let isReviewed = false;

  if (hasAccounts && confidence >= AUTO_APPROVE_THRESHOLD) {
    status = "approved";
    priority = 0;
    isReviewed = true;
  } else if (hasAccounts) {
    status = "pending_review";
    priority = 50;
  } else {
    // Uncategorized
    status = "pending_review";
    priority = 100;
  }

  // Create journal entry
  const [entry] = await dbPool
    .insert(journalEntryTable)
    .values({
      bookId,
      date: txn.date,
      memo: txn.memo,
      source,
      sourceReferenceId: txn.referenceId ?? null,
      isReviewed,
      isReconciled: false,
    })
    .returning();

  // Create journal lines when categorized
  if (debitAccountId && creditAccountId) {
    const insertedLines = await dbPool
      .insert(journalLineTable)
      .values([
        {
          journalEntryId: entry.id,
          accountId: debitAccountId,
          debit: amount.toFixed(4),
          credit: "0.0000",
        },
        {
          journalEntryId: entry.id,
          accountId: creditAccountId,
          debit: "0.0000",
          credit: amount.toFixed(4),
        },
      ])
      .returning();

    // Auto-tag journal lines if the matched rule has a tag
    if (tagId && insertedLines.length > 0) {
      await dbPool.insert(journalLineTagTable).values(
        insertedLines.map((line) => ({
          journalLineId: line.id,
          tagId: tagId!,
        })),
      );
    }
  }

  // Queue for reconciliation
  await dbPool.insert(reconciliationQueueTable).values({
    bookId,
    journalEntryId: entry.id,
    status,
    categorizationSource,
    confidence: confidence.toFixed(2),
    suggestedDebitAccountId: debitAccountId,
    suggestedCreditAccountId: creditAccountId,
    priority,
    periodYear: txnDate.getFullYear(),
    periodMonth: txnDate.getMonth() + 1,
  });

  return { entryId: entry.id, status, priority, confidence };
};

export { processTransaction };
