import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

type MantleEventBody = {
  event: string;
  data: {
    organizationId: string;
    referenceId: string;
    amount: number;
    currency?: string;
    memo?: string;
    metadata?: Record<string, unknown>;
  };
};

type WebhookResult = {
  success: boolean;
  journalEntryId?: string;
  error?: string;
};

const SUPPORTED_EVENTS = [
  "invoice.sent",
  "invoice.paid",
  "invoice.void",
  "inventory.adjustment",
] as const;

type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

/**
 * Determine if an event type is supported.
 */
const isSupportedEvent = (event: string): event is SupportedEvent =>
  (SUPPORTED_EVENTS as readonly string[]).includes(event);

/**
 * Build a memo string for the journal entry based on the event type.
 */
const buildMemo = (event: SupportedEvent, data: MantleEventBody["data"]) => {
  if (data.memo) return data.memo;

  const memoMap: Record<SupportedEvent, string> = {
    "invoice.sent": `Invoice ${data.referenceId} sent`,
    "invoice.paid": `Payment received for invoice ${data.referenceId}`,
    "invoice.void": `Invoice ${data.referenceId} voided (reversal)`,
    "inventory.adjustment": `Inventory adjustment ${data.referenceId}`,
  };

  return memoMap[event];
};

/**
 * Handle an incoming Mantle event from a Vortex webhook.
 *
 * Looks up the book by `organizationId`, checks for duplicate entries,
 * resolves account mappings, creates a journal entry with balanced lines,
 * and queues the entry for reconciliation review.
 */
const handleMantleEvent = async (
  body: MantleEventBody,
): Promise<WebhookResult> => {
  const { event, data } = body;

  if (!isSupportedEvent(event)) {
    return {
      success: false,
      error: `Unsupported event type: ${event}`,
    };
  }

  // Look up book by organizationId
  const [book] = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.organizationId, data.organizationId));

  if (!book) {
    return {
      success: false,
      error: `No book found for organization ${data.organizationId}`,
    };
  }

  // Duplicate detection: check for existing entry with same source + reference
  const [existing] = await dbPool
    .select({ id: journalEntryTable.id })
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.source, "mantle_sync"),
        eq(journalEntryTable.sourceReferenceId, data.referenceId),
      ),
    );

  if (existing) {
    return {
      success: true,
      journalEntryId: existing.id,
      error: "Duplicate event, entry already exists",
    };
  }

  // Look up account mapping for this event type in this book
  const [mapping] = await dbPool
    .select()
    .from(accountMappingTable)
    .where(
      and(
        eq(accountMappingTable.bookId, book.id),
        eq(accountMappingTable.eventType, event),
      ),
    );

  if (!mapping) {
    return {
      success: false,
      error: `No account mapping configured for event "${event}" in book "${book.name}". Configure mappings in the account mapping settings`,
    };
  }

  const amount = data.amount.toFixed(4);
  const memo = buildMemo(event, data);

  // Create journal entry + lines + reconciliation queue item in a transaction
  const result = await dbPool.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: book.id,
        date: new Date().toISOString(),
        memo,
        source: "mantle_sync",
        sourceReferenceId: data.referenceId,
        isReviewed: false,
        isReconciled: false,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    // Debit line
    await tx.insert(journalLineTable).values({
      journalEntryId: entry.id,
      accountId: mapping.debitAccountId,
      debit: amount,
      credit: "0",
      memo,
    } satisfies InferInsertModel<typeof journalLineTable>);

    // Credit line
    await tx.insert(journalLineTable).values({
      journalEntryId: entry.id,
      accountId: mapping.creditAccountId,
      debit: "0",
      credit: amount,
      memo,
    } satisfies InferInsertModel<typeof journalLineTable>);

    // Queue for reconciliation review
    await tx.insert(reconciliationQueueTable).values({
      bookId: book.id,
      journalEntryId: entry.id,
      status: "pending_review",
    } satisfies InferInsertModel<typeof reconciliationQueueTable>);

    return entry;
  });

  return {
    success: true,
    journalEntryId: result.id,
  };
};

export default handleMantleEvent;
