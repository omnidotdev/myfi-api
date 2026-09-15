import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  invoiceLineTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import {
  buildInvoicePostings,
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
} from "./invoicePosting";

import type { InferInsertModel } from "drizzle-orm";
import type { PricedLine } from "./invoicePosting";

/** Journal-entry source marking a posted customer invoice */
const INVOICE_SOURCE = "invoice";

interface PostInvoiceResult {
  invoiceId: string;
  journalEntryId: string;
  total: number;
  /** True when the invoice was already posted, so this call was a no-op */
  alreadyPosted: boolean;
}

/**
 * Post a draft invoice to the ledger: debit the book's Accounts Receivable for
 * the invoice total and credit each line's income account and each taxed line's
 * jurisdiction payable account, then mark the invoice open with its computed
 * totals. The ledger is the source of truth; the invoice subledger only records
 * what was posted.
 *
 * Idempotent: an invoice that is not in draft (already posted) is a no-op and
 * returns its existing journal entry. Line amounts are recomputed from quantity
 * times unit price and tax from the jurisdiction rate, so the posting reflects
 * the authoritative inputs rather than any stale stored amount
 */
export const postInvoice = async (
  invoiceId: string,
  bookId: string,
): Promise<PostInvoiceResult> => {
  const [invoice] = await dbPool
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }
  // Generic ownership guard (IDOR): the invoice must belong to the caller's book
  if (invoice.bookId !== bookId) {
    throw new Error("Invoice not found");
  }

  if (invoice.status !== "draft") {
    if (!invoice.journalEntryId) {
      throw new Error("Invoice is not draft but has no journal entry");
    }
    return {
      invoiceId,
      journalEntryId: invoice.journalEntryId,
      total: Number(invoice.total),
      alreadyPosted: true,
    };
  }

  // Lines joined to their tax jurisdiction for the rate and payable account
  const lineRows = await dbPool
    .select({
      quantity: invoiceLineTable.quantity,
      unitPrice: invoiceLineTable.unitPrice,
      incomeAccountId: invoiceLineTable.incomeAccountId,
      taxRate: taxJurisdictionTable.rate,
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
    })
    .from(invoiceLineTable)
    .leftJoin(
      taxJurisdictionTable,
      eq(invoiceLineTable.taxJurisdictionId, taxJurisdictionTable.id),
    )
    .where(eq(invoiceLineTable.invoiceId, invoiceId));

  if (lineRows.length === 0) {
    throw new Error("Invoice has no lines to post");
  }

  const [arAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, invoice.bookId),
        eq(accountTable.subType, "accounts_receivable"),
        eq(accountTable.isActive, true),
      ),
    )
    .limit(1);

  if (!arAccount) {
    throw new Error(
      "No active Accounts Receivable account exists for this book",
    );
  }

  const priced: PricedLine[] = lineRows.map((row) => {
    const amount = computeLineAmount(
      Number(row.quantity),
      Number(row.unitPrice),
    );
    const rate = row.taxRate === null ? 0 : Number(row.taxRate);
    const taxAmount = rate > 0 ? computeLineTax(amount, rate) : 0;
    return {
      amount,
      taxAmount,
      incomeAccountId: row.incomeAccountId,
      taxPayableAccountId: row.taxPayableAccountId,
    };
  });

  const totals = computeInvoiceTotals(priced);
  const postings = buildInvoicePostings({
    arAccountId: arAccount.id,
    lines: priced,
  });

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: invoice.bookId,
        date: invoice.issueDate,
        memo: `Invoice ${invoice.number}`,
        source: INVOICE_SOURCE,
        sourceReferenceId: invoiceId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    if (!entryRow) {
      throw new Error("Failed to write the invoice journal entry");
    }

    for (const posting of postings) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: posting.accountId,
        debit: posting.debit.toFixed(4),
        credit: posting.credit.toFixed(4),
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    await tx
      .update(invoiceTable)
      .set({
        status: "open",
        subtotal: totals.subtotal.toFixed(4),
        taxAmount: totals.taxAmount.toFixed(4),
        total: totals.total.toFixed(4),
        journalEntryId: entryRow.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoiceTable.id, invoiceId));

    return {
      invoiceId,
      journalEntryId: entryRow.id,
      total: totals.total,
      alreadyPosted: false,
    };
  });
};
