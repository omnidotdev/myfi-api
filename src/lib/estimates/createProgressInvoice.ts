import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { estimateLineTable, estimateTable } from "lib/db/schema";
import { createInvoiceDraft } from "lib/invoicing/createInvoiceDraft";
import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

interface ProgressInvoiceOptions {
  estimateId: string;
  bookId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  /** Percent of each line to bill on this invoice (0 < percent <= 100) */
  percent: number;
}

interface ProgressInvoiceResult {
  estimateId: string;
  invoiceId: string;
  /** True once every line is fully billed (estimate status becomes "invoiced") */
  fullyBilled: boolean;
}

/**
 * Create a progress invoice against an estimate: bill a percentage of each
 * line, carrying the billed amount as that line's value on a draft invoice, and
 * track the cumulative billed amount per line so repeated progress invoices can
 * never over-bill the estimate. When every line is fully billed the estimate is
 * marked "invoiced"; until then it is "partially_invoiced". Distinct from the
 * one-shot convertEstimateToInvoice, which bills the whole estimate once
 */
export const createProgressInvoice = async (
  opts: ProgressInvoiceOptions,
): Promise<ProgressInvoiceResult> => {
  const { estimateId, bookId, invoiceNumber, issueDate, dueDate, percent } =
    opts;

  if (!(percent > 0) || percent > 100) {
    throw new Error("Percent must be between 0 and 100");
  }

  const [estimate] = await dbPool
    .select()
    .from(estimateTable)
    .where(eq(estimateTable.id, estimateId));
  if (!estimate || estimate.bookId !== bookId) {
    throw new Error("Estimate not found");
  }
  if (estimate.status === "converted" || estimate.status === "invoiced") {
    throw new Error("Estimate is already fully invoiced");
  }
  if (estimate.status === "declined") {
    throw new Error("A declined estimate cannot be invoiced");
  }

  const lineRows = await dbPool
    .select()
    .from(estimateLineTable)
    .where(eq(estimateLineTable.estimateId, estimateId))
    .orderBy(estimateLineTable.sortOrder);
  if (lineRows.length === 0) {
    throw new Error("Estimate has no lines to invoice");
  }

  // Bill `percent` of each line's total, capped at its remaining unbilled amount
  const billings = lineRows.map((line) => {
    const amountUnits = toUnits(Number(line.amount));
    const remainingUnits = amountUnits - toUnits(Number(line.billedAmount));
    const wanted = Math.round((amountUnits * percent) / 100);
    const billUnits = Math.max(0, Math.min(wanted, remainingUnits));
    return { line, billUnits };
  });

  const toBill = billings.filter((b) => b.billUnits > 0);
  if (toBill.length === 0) {
    throw new Error("Nothing left to bill on this estimate");
  }

  const invoice = await createInvoiceDraft({
    bookId,
    customerId: estimate.customerId,
    number: invoiceNumber,
    issueDate,
    dueDate,
    memo: estimate.memo,
    lines: toBill.map((b) => ({
      description: `${b.line.description} (progress ${percent}%)`,
      quantity: 1,
      unitPrice: fromUnits(b.billUnits),
      incomeAccountId: b.line.incomeAccountId,
      taxJurisdictionId: b.line.taxJurisdictionId,
    })),
  });

  let fullyBilled = true;
  for (const b of billings) {
    const newBilledUnits = toUnits(Number(b.line.billedAmount)) + b.billUnits;
    if (newBilledUnits < toUnits(Number(b.line.amount))) fullyBilled = false;
    if (b.billUnits > 0) {
      await dbPool
        .update(estimateLineTable)
        .set({ billedAmount: fromUnits(newBilledUnits).toFixed(4) })
        .where(eq(estimateLineTable.id, b.line.id));
    }
  }

  await dbPool
    .update(estimateTable)
    .set({
      status: fullyBilled ? "invoiced" : "partially_invoiced",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(estimateTable.id, estimateId));

  return { estimateId, invoiceId: invoice.invoiceId, fullyBilled };
};
