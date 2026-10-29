import { dbPool } from "lib/db/db";
import { invoiceLineTable, invoiceTable } from "lib/db/schema";
import {
  applyLineDiscount,
  computeLineAmount,
  fromUnits,
  toUnits,
} from "./invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface DraftLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  incomeAccountId: string;
  taxJurisdictionId?: string | null;
  /** optional second tax on the line (stacks on the primary when compound) */
  secondaryTaxJurisdictionId?: string | null;
  /** optional line discount as a fraction (0.1 = 10% off), applied before tax */
  discountPercent?: number | null;
  /** optional inventory item this line sells (drives auto-COGS on posting) */
  inventoryItemId?: string | null;
}

interface CreateInvoiceDraftOptions {
  bookId: string;
  customerId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  memo?: string | null;
  terms?: string | null;
  /** Invoice currency; defaults to the book's home currency (USD) */
  currency?: string | null;
  /** Home-currency units per one unit of `currency` at the issue date; 1 for home */
  exchangeRate?: number | null;
  lines: DraftLineInput[];
}

interface CreateInvoiceDraftResult {
  invoiceId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create a draft invoice with its line items. The draft records the pre-tax
 * subtotal (line amounts are quantity times unit price); tax and the final
 * total are computed authoritatively when the invoice is posted, so a draft
 * carries tax 0 and total equal to subtotal. Created in one transaction
 */
export const createInvoiceDraft = async (
  opts: CreateInvoiceDraftOptions,
): Promise<CreateInvoiceDraftResult> => {
  const {
    bookId,
    customerId,
    number,
    issueDate,
    dueDate,
    memo,
    terms,
    currency,
    exchangeRate,
    lines,
  } = opts;

  if (lines.length === 0) {
    throw new Error("An invoice needs at least one line");
  }

  const priced = lines.map((line, index) => ({
    ...line,
    // amount is the post-discount net, so the subtotal and the stored line
    // amount both reflect what the customer actually owes for the line
    amount: applyLineDiscount(
      computeLineAmount(line.quantity, line.unitPrice),
      line.discountPercent,
    ),
    sortOrder: index,
  }));

  let subtotalUnits = 0;
  for (const line of priced) subtotalUnits += toUnits(line.amount);
  const subtotal = fromUnits(subtotalUnits);

  return dbPool.transaction(async (tx) => {
    const [invoiceRow] = await tx
      .insert(invoiceTable)
      .values({
        bookId,
        customerId,
        number,
        status: "draft",
        issueDate,
        dueDate,
        subtotal: subtotal.toFixed(4),
        taxAmount: "0.0000",
        total: subtotal.toFixed(4),
        memo: memo ?? null,
        terms: terms ?? null,
        ...(currency ? { currency } : {}),
        ...(exchangeRate != null ? { exchangeRate: exchangeRate.toFixed(8) } : {}),
      } satisfies InferInsertModel<typeof invoiceTable>)
      .returning();
    if (!invoiceRow) {
      throw new Error("Failed to create the invoice");
    }

    for (const line of priced) {
      await tx.insert(invoiceLineTable).values({
        invoiceId: invoiceRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        discountPercent:
          line.discountPercent != null ? line.discountPercent.toFixed(6) : null,
        incomeAccountId: line.incomeAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        secondaryTaxJurisdictionId: line.secondaryTaxJurisdictionId ?? null,
        inventoryItemId: line.inventoryItemId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof invoiceLineTable>);
    }

    return {
      invoiceId: invoiceRow.id,
      number,
      subtotal,
      lineCount: priced.length,
    };
  });
};
