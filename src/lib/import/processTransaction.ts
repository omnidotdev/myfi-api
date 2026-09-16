import { eq } from "drizzle-orm";

import { AUTO_APPROVE_THRESHOLD, categorize } from "lib/categorization";
import { dbPool } from "lib/db/db";
import {
  bookTable,
  journalEntryTable,
  journalLineProjectTable,
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
    if (catResult?.splits && catResult.splits.length >= 2) {
      // Split transaction: multiple lines per side
      const splitLines = catResult.splits.map((split) => {
        const splitAmount = split.percentage
          ? (amount * Number(split.percentage)) / 100
          : Number(split.fixedAmount);

        return {
          journalEntryId: entry.id,
          accountId: split.accountId,
          debit: split.side === "debit" ? splitAmount.toFixed(4) : "0.0000",
          credit: split.side === "credit" ? splitAmount.toFixed(4) : "0.0000",
          memo: split.memo,
        };
      });

      // Remainder handling: adjust last line of each side to absorb rounding
      const debitSplits = splitLines.filter((l) => l.debit !== "0.0000");
      const creditSplits = splitLines.filter((l) => l.credit !== "0.0000");

      const adjustRemainder = (
        lines: typeof splitLines,
        field: "debit" | "credit",
      ) => {
        if (lines.length === 0) return;
        const sum = lines.reduce((s, l) => s + Number(l[field]), 0);
        const diff = amount - sum;
        if (Math.abs(diff) > 0.0001 && lines.length > 0) {
          const last = lines[lines.length - 1];
          last[field] = (Number(last[field]) + diff).toFixed(4);
        }
      };

      adjustRemainder(debitSplits, "debit");
      adjustRemainder(creditSplits, "credit");

      const insertedLines = await dbPool
        .insert(journalLineTable)
        .values(splitLines)
        .returning();

      // Auto-tag split lines using per-split tagIds
      const tagAssignments: { journalLineId: string; tagId: string }[] = [];
      for (let i = 0; i < catResult.splits.length; i++) {
        const splitTagId = catResult.splits[i].tagId;
        if (splitTagId && insertedLines[i]) {
          tagAssignments.push({
            journalLineId: insertedLines[i].id,
            tagId: splitTagId,
          });
        }
      }
      if (tagAssignments.length > 0) {
        await dbPool.insert(journalLineTagTable).values(tagAssignments);
      }

      // Auto-assign projects from per-split projectIds, with rule-level fallback
      const projectAssignments: { journalLineId: string; projectId: string }[] =
        [];
      for (let i = 0; i < catResult.splits.length; i++) {
        const splitProjectId = catResult.splits[i].projectId;
        if (splitProjectId && insertedLines[i]) {
          projectAssignments.push({
            journalLineId: insertedLines[i].id,
            projectId: splitProjectId,
          });
        }
      }
      if (catResult.projectId) {
        for (let i = 0; i < catResult.splits.length; i++) {
          if (!catResult.splits[i].projectId && insertedLines[i]) {
            projectAssignments.push({
              journalLineId: insertedLines[i].id,
              projectId: catResult.projectId,
            });
          }
        }
      }
      if (projectAssignments.length > 0) {
        await dbPool.insert(journalLineProjectTable).values(projectAssignments);
      }
    } else {
      // Standard two-line entry
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

      // Auto-assign project if the matched rule has a project
      if (catResult?.projectId && insertedLines?.length) {
        await dbPool.insert(journalLineProjectTable).values(
          insertedLines.map((line) => ({
            journalLineId: line.id,
            projectId: catResult.projectId!,
          })),
        );
      }
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
