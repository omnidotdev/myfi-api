import { and, eq } from "drizzle-orm";

import { emitAudit } from "lib/audit";
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
    // Legacy format
    organizationId?: string;
    referenceId?: string;
    amount?: number;
    currency?: string;
    memo?: string;
    metadata?: Record<string, unknown>;
    // Mantle native format
    id?: string;
    companyId?: string;
    contactId?: string;
    invoiceNumber?: string;
    status?: string;
    total?: string | number;
    issueDate?: string;
    dueDate?: string;
    paidAt?: string;
    paymentReference?: string;
    // Quote fields
    quoteNumber?: string;
    convertedInvoiceId?: string;
  };
};

type WebhookResult = {
  success: boolean;
  journalEntryId?: string;
  error?: string;
};

/**
 * Normalized event data used internally after resolving the event format.
 */
type NormalizedEvent = {
  accountingEvent: LegacyEvent;
  organizationId: string;
  referenceId: string;
  amount: number;
  currency?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
};

const SUPPORTED_EVENTS = [
  // Legacy format
  "invoice.sent",
  "invoice.paid",
  "invoice.void",
  "bill.created",
  "bill.paid",
  "bill.void",
  "inventory.adjustment",
  // Mantle native format
  "mantle.invoice.created",
  "mantle.invoice.updated",
  "mantle.invoice.deleted",
  "mantle.quote.created",
  "mantle.quote.updated",
  "mantle.quote.deleted",
] as const;

type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

// Legacy event types that map to account mappings
type LegacyEvent = Extract<
  SupportedEvent,
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.void"
  | "bill.created"
  | "bill.paid"
  | "bill.void"
  | "inventory.adjustment"
>;

/**
 * Map Mantle invoice status to the corresponding legacy accounting event.
 * Returns undefined for statuses that don't require a journal entry.
 */
const statusToLegacyEvent = (
  status: string | undefined,
): LegacyEvent | undefined => {
  switch (status) {
    case "sent":
      return "invoice.sent";
    case "paid":
      return "invoice.paid";
    case "void":
      return "invoice.void";
    default:
      return undefined;
  }
};

/**
 * Determine if an event type is supported.
 */
const isSupportedEvent = (event: string): event is SupportedEvent =>
  (SUPPORTED_EVENTS as readonly string[]).includes(event);

/**
 * Check if an event is a Mantle native event.
 */
const isMantleNativeEvent = (event: string): boolean =>
  event.startsWith("mantle.");

/**
 * Normalize a Mantle native event into the internal format used for journal entries.
 * Returns undefined when no journal entry is needed (e.g. draft status).
 */
const normalizeMantleEvent = (
  body: MantleEventBody,
): NormalizedEvent | undefined => {
  const { event, data } = body;

  if (!data.organizationId || !data.id) return undefined;

  if (event === "mantle.invoice.created") {
    // Only create a journal entry for invoices that are sent on creation
    const legacyEvent = statusToLegacyEvent(data.status);

    if (!legacyEvent) return undefined;

    return {
      accountingEvent: legacyEvent,
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: parseTotal(data.total),
      currency: data.currency,
      memo:
        data.memo ?? `Invoice ${data.invoiceNumber ?? data.id} ${data.status}`,
    };
  }

  if (event === "mantle.invoice.updated") {
    const legacyEvent = statusToLegacyEvent(data.status);

    if (!legacyEvent) return undefined;

    return {
      accountingEvent: legacyEvent,
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: parseTotal(data.total),
      currency: data.currency,
      memo:
        data.memo ?? `Invoice ${data.invoiceNumber ?? data.id} ${data.status}`,
    };
  }

  if (event === "mantle.invoice.deleted") {
    return {
      accountingEvent: "invoice.void",
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: parseTotal(data.total),
      currency: data.currency,
      memo:
        data.memo ??
        `Invoice ${data.invoiceNumber ?? data.id} deleted (reversal)`,
    };
  }

  // Quote events: only create journal entries for converted quotes
  // (the resulting invoice event handles the actual AR recognition)
  if (
    event === "mantle.quote.updated" &&
    data.status === "accepted" &&
    data.convertedInvoiceId
  ) {
    // Quote accepted and converted to invoice; record as a pipeline note
    // No journal entry needed, the mantle.invoice.* event handles accounting
    return undefined;
  }

  // Quote created/updated/deleted: no journal entries needed
  // Quotes are pre-transaction documents with no accounting impact
  if (event.startsWith("mantle.quote.")) {
    return undefined;
  }

  return undefined;
};

/**
 * Parse total from string or number into a number.
 */
const parseTotal = (total: string | number | undefined): number => {
  if (total === undefined || total === null) return 0;
  if (typeof total === "number") return total;

  const parsed = Number.parseFloat(total);

  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Build a memo string for the journal entry based on the event type.
 */
const buildMemo = (
  event: LegacyEvent,
  data: { referenceId: string; memo?: string },
) => {
  if (data.memo) return data.memo;

  const memoMap: Record<LegacyEvent, string> = {
    "invoice.sent": `Invoice ${data.referenceId} sent`,
    "invoice.paid": `Payment received for invoice ${data.referenceId}`,
    "invoice.void": `Invoice ${data.referenceId} voided (reversal)`,
    "bill.created": `Bill ${data.referenceId} received`,
    "bill.paid": `Payment for bill ${data.referenceId}`,
    "bill.void": `Bill ${data.referenceId} voided (reversal)`,
    "inventory.adjustment": `Inventory adjustment ${data.referenceId}`,
  };

  return memoMap[event];
};

/**
 * Create a journal entry from normalized event data.
 */
const createJournalEntry = async (
  normalized: NormalizedEvent,
  originalEvent: string,
): Promise<WebhookResult> => {
  const { accountingEvent, organizationId, referenceId, amount, memo } =
    normalized;

  // Look up book by organizationId
  const [book] = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.organizationId, organizationId));

  if (!book) {
    return {
      success: false,
      error: `No book found for organization ${organizationId}`,
    };
  }

  // Duplicate detection: check for existing entry with same source + reference
  const [existing] = await dbPool
    .select({ id: journalEntryTable.id })
    .from(journalEntryTable)
    .where(
      and(
        eq(journalEntryTable.source, "mantle_sync"),
        eq(journalEntryTable.sourceReferenceId, referenceId),
      ),
    );

  if (existing) {
    return {
      success: true,
      journalEntryId: existing.id,
      error: "Duplicate event, entry already exists",
    };
  }

  // Look up account mapping for the accounting event type
  const [mapping] = await dbPool
    .select()
    .from(accountMappingTable)
    .where(
      and(
        eq(accountMappingTable.bookId, book.id),
        eq(accountMappingTable.eventType, accountingEvent),
      ),
    );

  if (!mapping) {
    return {
      success: false,
      error: `No account mapping configured for event "${accountingEvent}" in book "${book.name}". Configure mappings in the account mapping settings`,
    };
  }

  const amountStr = amount.toFixed(4);
  const entryMemo = memo ?? buildMemo(accountingEvent, { referenceId });

  // Create journal entry + lines + reconciliation queue item in a transaction
  const result = await dbPool.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: book.id,
        date: new Date().toISOString(),
        memo: entryMemo,
        source: "mantle_sync",
        sourceReferenceId: referenceId,
        vendorId: (normalized.metadata?.vendorId as string) ?? null,
        isReviewed: false,
        isReconciled: false,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    // Debit line
    await tx.insert(journalLineTable).values({
      journalEntryId: entry.id,
      accountId: mapping.debitAccountId,
      debit: amountStr,
      credit: "0",
      memo: entryMemo,
    } satisfies InferInsertModel<typeof journalLineTable>);

    // Credit line
    await tx.insert(journalLineTable).values({
      journalEntryId: entry.id,
      accountId: mapping.creditAccountId,
      debit: "0",
      credit: amountStr,
      memo: entryMemo,
    } satisfies InferInsertModel<typeof journalLineTable>);

    // Queue for reconciliation review
    await tx.insert(reconciliationQueueTable).values({
      bookId: book.id,
      journalEntryId: entry.id,
      status: "pending_review",
    } satisfies InferInsertModel<typeof reconciliationQueueTable>);

    return entry;
  });

  emitAudit({
    type: `myfi.mantle_event.${originalEvent}`,
    organizationId,
    actor: { id: "system", name: "Mantle Sync" },
    resource: { type: "journal_entry", id: result.id },
    data: { event: originalEvent, referenceId, amount },
  });

  return {
    success: true,
    journalEntryId: result.id,
  };
};

/**
 * Handle an incoming Mantle event from a Vortex webhook.
 *
 * Supports both legacy event format (invoice.sent, invoice.paid, etc.) and
 * Mantle native CloudEvents format (mantle.invoice.created/updated/deleted).
 *
 * For Mantle native events, the invoice status determines the accounting action:
 * - "sent" -> AR recognition (invoice.sent)
 * - "paid" -> cash receipt (invoice.paid)
 * - "void" -> reversal (invoice.void)
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

  // Handle Mantle native events by normalizing to internal format
  if (isMantleNativeEvent(event)) {
    // Emit audit trail for quote-to-invoice conversions
    if (
      event === "mantle.quote.updated" &&
      data.status === "converted" &&
      data.convertedInvoiceId &&
      data.organizationId
    ) {
      emitAudit({
        type: "myfi.quote.converted_to_invoice",
        organizationId: data.organizationId,
        actor: { id: "system", name: "Mantle Sync" },
        resource: { type: "quote", id: data.id ?? "unknown" },
        data: {
          quoteNumber: data.quoteNumber,
          convertedInvoiceId: data.convertedInvoiceId,
          total: data.total,
        },
      });

      return {
        success: true,
        error:
          "Quote converted to invoice, audit recorded. Invoice event will create journal entry.",
      };
    }

    const normalized = normalizeMantleEvent(body);

    if (!normalized) {
      return {
        success: true,
        error: "No journal entry needed for this status change",
      };
    }

    return createJournalEntry(normalized, event);
  }

  // Legacy format: data must have organizationId, referenceId, amount
  if (!data.organizationId || !data.referenceId || data.amount === undefined) {
    return {
      success: false,
      error:
        "Legacy event format requires organizationId, referenceId, and amount in data",
    };
  }

  return createJournalEntry(
    {
      accountingEvent: event as LegacyEvent,
      organizationId: data.organizationId,
      referenceId: data.referenceId,
      amount: data.amount,
      currency: data.currency,
      memo: data.memo,
      metadata: data.metadata,
    },
    event,
  );
};

export default handleMantleEvent;
