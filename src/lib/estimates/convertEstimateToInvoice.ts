import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { estimateLineTable, estimateTable } from "lib/db/schema";
import { createInvoiceDraft } from "lib/invoicing/createInvoiceDraft";

interface ConvertEstimateOptions {
  estimateId: string;
  bookId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
}

interface ConvertEstimateResult {
  estimateId: string;
  invoiceId: string;
  /** True when the estimate was already converted, so this call was a no-op */
  alreadyConverted: boolean;
}

/**
 * Convert an estimate into a draft invoice, carrying over its line items
 * (description, quantity, unit price, income account, tax jurisdiction), and
 * mark the estimate converted. The resulting invoice is a normal draft that then
 * follows the post/pay flow. Idempotent: a converted estimate returns its
 * existing invoice. A declined estimate cannot be converted
 */
export const convertEstimateToInvoice = async (
  opts: ConvertEstimateOptions,
): Promise<ConvertEstimateResult> => {
  const { estimateId, bookId, invoiceNumber, issueDate, dueDate } = opts;

  const [estimate] = await dbPool
    .select()
    .from(estimateTable)
    .where(eq(estimateTable.id, estimateId));

  if (!estimate) {
    throw new Error("Estimate not found");
  }
  // Generic ownership guard (IDOR)
  if (estimate.bookId !== bookId) {
    throw new Error("Estimate not found");
  }
  if (estimate.status === "converted") {
    if (!estimate.convertedInvoiceId) {
      throw new Error("Estimate is converted but has no invoice");
    }
    return {
      estimateId,
      invoiceId: estimate.convertedInvoiceId,
      alreadyConverted: true,
    };
  }
  if (estimate.status === "declined") {
    throw new Error("A declined estimate cannot be converted");
  }

  const lineRows = await dbPool
    .select()
    .from(estimateLineTable)
    .where(eq(estimateLineTable.estimateId, estimateId))
    .orderBy(estimateLineTable.sortOrder);

  if (lineRows.length === 0) {
    throw new Error("Estimate has no lines to convert");
  }

  const invoice = await createInvoiceDraft({
    bookId,
    customerId: estimate.customerId,
    number: invoiceNumber,
    issueDate,
    dueDate,
    memo: estimate.memo,
    lines: lineRows.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      incomeAccountId: l.incomeAccountId,
      taxJurisdictionId: l.taxJurisdictionId,
    })),
  });

  await dbPool
    .update(estimateTable)
    .set({
      status: "converted",
      convertedInvoiceId: invoice.invoiceId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(estimateTable.id, estimateId));

  return { estimateId, invoiceId: invoice.invoiceId, alreadyConverted: false };
};
