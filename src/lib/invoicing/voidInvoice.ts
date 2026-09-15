import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  invoicePaymentTable,
  invoiceTable,
  journalEntryTable,
} from "lib/db/schema";

interface VoidInvoiceResult {
  invoiceId: string;
  /** True when the invoice was already void, so this call was a no-op */
  alreadyVoid: boolean;
}

/**
 * Void an invoice: reverse its ledger effect by deleting its journal entry (the
 * lines cascade) and mark it void. Refused when payments exist, since a paid
 * invoice must be handled with a credit/refund rather than a silent void. A
 * draft invoice (never posted) is simply marked void with no ledger change
 */
export const voidInvoice = async (
  invoiceId: string,
  bookId: string,
): Promise<VoidInvoiceResult> => {
  const [invoice] = await dbPool
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }
  // Generic ownership guard (IDOR)
  if (invoice.bookId !== bookId) {
    throw new Error("Invoice not found");
  }
  if (invoice.status === "void") {
    return { invoiceId, alreadyVoid: true };
  }

  const payments = await dbPool
    .select({ id: invoicePaymentTable.id })
    .from(invoicePaymentTable)
    .where(eq(invoicePaymentTable.invoiceId, invoiceId));
  if (payments.length > 0) {
    throw new Error("Cannot void an invoice that has payments");
  }

  return dbPool.transaction(async (tx) => {
    if (invoice.journalEntryId) {
      await tx
        .delete(journalEntryTable)
        .where(eq(journalEntryTable.id, invoice.journalEntryId));
    }

    await tx
      .update(invoiceTable)
      .set({
        status: "void",
        journalEntryId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoiceTable.id, invoiceId));

    return { invoiceId, alreadyVoid: false };
  });
};
