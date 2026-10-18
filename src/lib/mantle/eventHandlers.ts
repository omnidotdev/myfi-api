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
import { adoptMantleSource } from "lib/mantle/invoiceSource";

import type { InferInsertModel } from "drizzle-orm";

type MantleEventBody = {
  event: string;
  data: {
    // Legacy format
    organizationId?: string;
    referenceId?: string;
    amount?: number | string;
    currency?: string;
    memo?: string;
    metadata?: Record<string, unknown>;
    // Mantle native format
    id?: string;
    invoiceId?: string;
    paymentId?: string;
    kind?: string;
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

export type WebhookResult = {
  success: boolean;
  journalEntryId?: string;
  error?: string;
  /**
   * Whether the failure is transient and the event should be redelivered.
   *
   * Set on config-not-yet-in-place failures (no book for the org, no account
   * mapping) which routinely happen when an event arrives before an admin has
   * finished setup. The webhook maps this to a non-2xx so Vortex retries.
   * Terminal failures (unsupported/malformed events) and duplicates leave it
   * unset so they return 2xx and are not retried forever.
   */
  retryable?: boolean;
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
  // Mantle native payment + credit events (per-amount recognition)
  "mantle.payment.created",
  "mantle.payment.updated",
  "mantle.payment.deleted",
  "mantle.credit.issued",
  "mantle.credit.applied",
] as const;

type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];

/**
 * Accounting event types that key an `account_mapping` (debit/credit account
 * pair) and a journal entry. Named "legacy" historically; it is the set of
 * internal accounting events, which is broader than the on-the-wire event types
 * (e.g. a `mantle.payment.created` event maps to the `payment.received`
 * accounting event). The debit/credit DIRECTION for each lives in the per-book
 * `account_mapping` config, not here.
 */
type LegacyEvent =
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.void"
  | "bill.created"
  | "bill.paid"
  | "bill.void"
  | "inventory.adjustment"
  | "payment.received"
  | "payment.reversed"
  | "credit.issued"
  | "credit.applied";

/**
 * Map a Mantle NATIVE invoice status to its accounting event. Returns undefined
 * for statuses that book nothing.
 *
 * "paid" deliberately books nothing: cash receipt is now recognized per payment
 * from `mantle.payment.*`, and A/R relief by credit from `mantle.credit.applied`.
 * Booking the full invoice total here as well would double-count the cash. The
 * legacy `invoice.paid` event (older emitters) still books via the legacy path.
 */
const statusToLegacyEvent = (
  status: string | undefined,
): LegacyEvent | undefined => {
  switch (status) {
    case "sent":
      return "invoice.sent";
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

  // Payment received against an invoice: book the PAYMENT amount (not the
  // invoice total) so partial and per-payment cash is recognized. Keyed on the
  // payment id so each payment books once
  if (event === "mantle.payment.created") {
    return {
      accountingEvent: "payment.received",
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: parseTotal(data.amount),
      currency: data.currency,
      memo:
        data.memo ??
        `Payment received${data.invoiceId ? ` for invoice ${data.invoiceId}` : ""}`,
    };
  }

  // A deleted payment reverses its cash recognition. Booked as its own
  // `payment.reversed` accounting event (its mapping posts the opposite of
  // `payment.received`, e.g. Dr A/R / Cr Cash) and keyed distinctly so it posts
  // alongside the original rather than deduping against it
  if (event === "mantle.payment.deleted") {
    return {
      accountingEvent: "payment.reversed",
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: parseTotal(data.amount),
      currency: data.currency,
      memo: data.memo ?? `Payment ${data.id} reversed`,
    };
  }

  // Payment amount edits are not booked: the event carries only the new amount,
  // not the delta, so a correct adjustment cannot be derived here. Acking
  // without booking is safe (never mis-books)
  if (event === "mantle.payment.updated") {
    return undefined;
  }

  // Credit issued (overpayment) or applied (drawn against an invoice). The
  // credit ledger stores application as a negative amount, so book the
  // magnitude; the debit/credit account direction is in the per-book mapping
  if (event === "mantle.credit.issued" || event === "mantle.credit.applied") {
    const accountingEvent: LegacyEvent =
      event === "mantle.credit.issued" ? "credit.issued" : "credit.applied";

    return {
      accountingEvent,
      organizationId: data.organizationId,
      referenceId: data.id,
      amount: Math.abs(parseTotal(data.amount)),
      currency: data.currency,
      memo:
        data.memo ??
        `Credit ${event === "mantle.credit.issued" ? "issued" : "applied"} ${data.id}`,
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
    "payment.received": `Payment received ${data.referenceId}`,
    "payment.reversed": `Payment ${data.referenceId} reversed`,
    "credit.issued": `Credit issued ${data.referenceId}`,
    "credit.applied": `Credit applied ${data.referenceId}`,
  };

  return memoMap[event];
};

/**
 * Build the tenant-scoped dedup predicate for a Mantle-sourced journal entry.
 *
 * Scoped by book (which resolves 1:1 from the organization) so a legacy
 * sourceReferenceId shared across organizations does not collide. Kept as a
 * named helper so the same predicate is reused by the pre-insert check and is
 * unit-testable independently of a live database.
 */
export const mantleDedupCondition = (
  bookId: string,
  sourceReferenceId: string,
) =>
  and(
    eq(journalEntryTable.bookId, bookId),
    eq(journalEntryTable.source, "mantle_sync"),
    eq(journalEntryTable.sourceReferenceId, sourceReferenceId),
  );

/**
 * Create a journal entry from normalized event data.
 */
const createJournalEntry = async (
  normalized: NormalizedEvent,
  originalEvent: string,
): Promise<WebhookResult> => {
  const { accountingEvent, organizationId, referenceId, amount, memo } =
    normalized;

  // Idempotency key scoped to the accounting event, not just the invoice id.
  // A single invoice legitimately produces multiple journal entries across its
  // lifecycle (invoice.sent -> Dr A/R, invoice.paid -> Dr Cash / Cr A/R,
  // invoice.void -> reversal). Keying on the invoice id alone collapses every
  // later lifecycle event into the first entry, so A/R is never relieved, cash
  // is never recognized, and voids never reverse. Including the accounting event
  // keeps each distinct lifecycle event as its own entry while still deduping a
  // true replay (same invoice + same event)
  const sourceReferenceId = `${referenceId}:${accountingEvent}`;

  // Look up book by organizationId
  const [book] = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.organizationId, organizationId));

  if (!book) {
    // Transient: the book may not be provisioned yet. Retry rather than drop
    // the financial event
    return {
      success: false,
      retryable: true,
      error: `No book found for organization ${organizationId}`,
    };
  }

  // Auto-adopt Mantle as this book's source of record on the first Mantle event,
  // so no manual setup is needed. From here MyFi records Mantle's accounting and
  // its native invoice/quote/inventory creation is disabled for the book
  const adopted = await adoptMantleSource(book.id);
  if (adopted) {
    emitAudit({
      type: "myfi.book.invoice_source_changed",
      organizationId,
      actor: { id: "mantle" },
      resource: { type: "book", id: book.id, name: book.name },
      data: { invoiceSource: "mantle", reason: "mantle_event_received" },
    });
  }

  // Duplicate detection: check for an existing entry with the same book +
  // source + event-scoped reference (invoice id + accounting event). Scoping by
  // book keeps a legacy sourceReferenceId from matching another org's entry
  const [existing] = await dbPool
    .select({ id: journalEntryTable.id })
    .from(journalEntryTable)
    .where(mantleDedupCondition(book.id, sourceReferenceId));

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
    // Transient: the mapping is often configured after the first event arrives.
    // Retry so the event is not silently lost before setup completes
    return {
      success: false,
      retryable: true,
      error: `No account mapping configured for event "${accountingEvent}" in book "${book.name}". Configure mappings in the account mapping settings`,
    };
  }

  const amountStr = amount.toFixed(4);
  const entryMemo = memo ?? buildMemo(accountingEvent, { referenceId });

  // Create journal entry + lines + reconciliation queue item in a transaction
  const result = await dbPool.transaction(async (tx) => {
    // onConflictDoNothing on the (book, source, source_reference_id) unique
    // constraint closes the check-then-insert race: a concurrent identical
    // event that passed the pre-check above inserts nothing here and returns no
    // row, so it is treated as a duplicate rather than double-posting
    const [entry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: book.id,
        date: new Date().toISOString(),
        memo: entryMemo,
        source: "mantle_sync",
        sourceReferenceId,
        vendorId: (normalized.metadata?.vendorId as string) ?? null,
        isReviewed: false,
        isReconciled: false,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .onConflictDoNothing({
        target: [
          journalEntryTable.bookId,
          journalEntryTable.source,
          journalEntryTable.sourceReferenceId,
        ],
      })
      .returning();

    // A concurrent insert won the race and already created this entry; skip the
    // lines and reconciliation item so nothing is double-written
    if (!entry) return null;

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

  // Lost the insert race: the entry already exists, so treat as a duplicate
  if (!result) {
    return {
      success: true,
      error: "Duplicate event, entry already exists",
    };
  }

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
      amount: parseTotal(data.amount),
      currency: data.currency,
      memo: data.memo,
      metadata: data.metadata,
    },
    event,
  );
};

export default handleMantleEvent;
