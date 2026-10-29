import { dbPool } from "lib/db/db";
import { creditMemoLineTable, creditMemoTable } from "lib/db/schema";
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
  incomeAccountId: string;
  taxJurisdictionId?: string | null;
  /** optional line discount as a fraction (0.1 = 10% off), applied before tax */
  discountPercent?: number | null;
  /** optional inventory item this line returns to stock when the memo is posted */
  inventoryItemId?: string | null;
}

interface CreateCreditMemoDraftOptions {
  bookId: string;
  customerId: string;
  number: string;
  date: string;
  memo?: string | null;
  lines: DraftLineInput[];
}

interface CreateCreditMemoDraftResult {
  creditMemoId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create a draft credit memo with its line items. The draft records the pre-tax
 * subtotal (line amounts are quantity times unit price, net of any discount);
 * tax and the final total are computed authoritatively when the memo is posted,
 * so a draft carries tax 0 and total equal to subtotal. Created in one
 * transaction, mirroring createInvoiceDraft
 */
export const createCreditMemoDraft = async (
  opts: CreateCreditMemoDraftOptions,
): Promise<CreateCreditMemoDraftResult> => {
  const { bookId, customerId, number, date, memo, lines } = opts;

  if (lines.length === 0) {
    throw new Error("A credit memo needs at least one line");
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
    const [memoRow] = await tx
      .insert(creditMemoTable)
      .values({
        bookId,
        customerId,
        number,
        status: "draft",
        date,
        subtotal: subtotal.toFixed(4),
        taxAmount: "0.0000",
        total: subtotal.toFixed(4),
        memo: memo ?? null,
      } satisfies InferInsertModel<typeof creditMemoTable>)
      .returning();
    if (!memoRow) {
      throw new Error("Failed to create the credit memo");
    }

    for (const line of priced) {
      await tx.insert(creditMemoLineTable).values({
        creditMemoId: memoRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        discountPercent:
          line.discountPercent != null ? line.discountPercent.toFixed(6) : null,
        incomeAccountId: line.incomeAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        inventoryItemId: line.inventoryItemId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof creditMemoLineTable>);
    }

    return {
      creditMemoId: memoRow.id,
      number,
      subtotal,
      lineCount: priced.length,
    };
  });
};
