import { dbPool } from "lib/db/db";
import { vendorCreditLineTable, vendorCreditTable } from "lib/db/schema";
import {
  applyLineDiscount,
  computeLineAmount,
  fromUnits,
  toUnits,
} from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface DraftLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  expenseAccountId: string;
  taxJurisdictionId?: string | null;
  /** optional line discount as a fraction (0.1 = 10% off), applied before tax */
  discountPercent?: number | null;
}

interface CreateVendorCreditDraftOptions {
  bookId: string;
  vendorId: string;
  number: string;
  date: string;
  memo?: string | null;
  /** Vendor-credit currency; defaults to the book's home currency (USD) */
  currency?: string | null;
  /** Home-currency units per one unit of `currency` at the credit date; 1 for home */
  exchangeRate?: number | null;
  lines: DraftLineInput[];
}

interface CreateVendorCreditDraftResult {
  vendorCreditId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create a draft vendor credit with its line items. The draft records the
 * pre-tax subtotal (line amounts are quantity times unit price, net of any
 * discount); tax and the final total are computed authoritatively when the
 * credit is posted, so a draft carries tax 0 and total equal to subtotal.
 * Created in one transaction, mirroring createBillDraft
 */
export const createVendorCreditDraft = async (
  opts: CreateVendorCreditDraftOptions,
): Promise<CreateVendorCreditDraftResult> => {
  const {
    bookId,
    vendorId,
    number,
    date,
    memo,
    currency,
    exchangeRate,
    lines,
  } = opts;

  if (lines.length === 0) {
    throw new Error("A vendor credit needs at least one line");
  }

  const priced = lines.map((line, index) => ({
    ...line,
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
    const [creditRow] = await tx
      .insert(vendorCreditTable)
      .values({
        bookId,
        vendorId,
        number,
        status: "draft",
        date,
        subtotal: subtotal.toFixed(4),
        taxAmount: "0.0000",
        total: subtotal.toFixed(4),
        memo: memo ?? null,
        ...(currency ? { currency } : {}),
        ...(exchangeRate != null
          ? { exchangeRate: exchangeRate.toFixed(8) }
          : {}),
      } satisfies InferInsertModel<typeof vendorCreditTable>)
      .returning();
    if (!creditRow) {
      throw new Error("Failed to create the vendor credit");
    }

    for (const line of priced) {
      await tx.insert(vendorCreditLineTable).values({
        vendorCreditId: creditRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        discountPercent:
          line.discountPercent != null ? line.discountPercent.toFixed(6) : null,
        expenseAccountId: line.expenseAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof vendorCreditLineTable>);
    }

    return {
      vendorCreditId: creditRow.id,
      number,
      subtotal,
      lineCount: priced.length,
    };
  });
};
