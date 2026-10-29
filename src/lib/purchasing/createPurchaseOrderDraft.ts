import { dbPool } from "lib/db/db";
import { purchaseOrderLineTable, purchaseOrderTable } from "lib/db/schema";
import {
  computeLineAmount,
  fromUnits,
  toUnits,
} from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface DraftPurchaseOrderLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  expenseAccountId: string;
  taxJurisdictionId?: string | null;
}

interface CreatePurchaseOrderDraftOptions {
  bookId: string;
  vendorId: string;
  number: string;
  date: string;
  memo?: string | null;
  lines: DraftPurchaseOrderLineInput[];
}

interface CreatePurchaseOrderDraftResult {
  purchaseOrderId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create an open purchase order with line items. Records the pre-tax subtotal; a
 * purchase order has no ledger effect until it is converted into a bill
 */
export const createPurchaseOrderDraft = async (
  opts: CreatePurchaseOrderDraftOptions,
): Promise<CreatePurchaseOrderDraftResult> => {
  const { bookId, vendorId, number, date, memo, lines } = opts;

  if (lines.length === 0) {
    throw new Error("A purchase order needs at least one line");
  }

  const priced = lines.map((line, index) => ({
    ...line,
    amount: computeLineAmount(line.quantity, line.unitPrice),
    sortOrder: index,
  }));

  let subtotalUnits = 0;
  for (const line of priced) subtotalUnits += toUnits(line.amount);
  const subtotal = fromUnits(subtotalUnits);

  return dbPool.transaction(async (tx) => {
    const [purchaseOrderRow] = await tx
      .insert(purchaseOrderTable)
      .values({
        bookId,
        vendorId,
        number,
        status: "open",
        date,
        subtotal: subtotal.toFixed(4),
        total: subtotal.toFixed(4),
        memo: memo ?? null,
      } satisfies InferInsertModel<typeof purchaseOrderTable>)
      .returning();
    if (!purchaseOrderRow) {
      throw new Error("Failed to create the purchase order");
    }

    for (const line of priced) {
      await tx.insert(purchaseOrderLineTable).values({
        purchaseOrderId: purchaseOrderRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        expenseAccountId: line.expenseAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof purchaseOrderLineTable>);
    }

    return {
      purchaseOrderId: purchaseOrderRow.id,
      number,
      subtotal,
      lineCount: priced.length,
    };
  });
};
