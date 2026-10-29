import { eq } from "drizzle-orm";

import { createBillDraft } from "lib/billing/createBillDraft";
import { dbPool } from "lib/db/db";
import { purchaseOrderLineTable, purchaseOrderTable } from "lib/db/schema";

interface ConvertPurchaseOrderOptions {
  purchaseOrderId: string;
  bookId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
}

interface ConvertPurchaseOrderResult {
  purchaseOrderId: string;
  billId: string;
  /** True when the purchase order was already converted, so this call was a no-op */
  alreadyConverted: boolean;
}

/**
 * Convert a purchase order into a draft bill, carrying over its line items
 * (description, quantity, unit price, expense account, tax jurisdiction), and
 * mark the purchase order converted. The resulting bill is a normal draft that
 * then follows the post/pay flow. Idempotent: a converted purchase order returns
 * its existing bill. A void purchase order cannot be converted
 */
export const convertPurchaseOrderToBill = async (
  opts: ConvertPurchaseOrderOptions,
): Promise<ConvertPurchaseOrderResult> => {
  const { purchaseOrderId, bookId, billNumber, billDate, dueDate } = opts;

  const [purchaseOrder] = await dbPool
    .select()
    .from(purchaseOrderTable)
    .where(eq(purchaseOrderTable.id, purchaseOrderId));

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }
  // Generic ownership guard (IDOR)
  if (purchaseOrder.bookId !== bookId) {
    throw new Error("Purchase order not found");
  }
  if (purchaseOrder.status === "converted") {
    if (!purchaseOrder.convertedBillId) {
      throw new Error("Purchase order is converted but has no bill");
    }
    return {
      purchaseOrderId,
      billId: purchaseOrder.convertedBillId,
      alreadyConverted: true,
    };
  }
  if (purchaseOrder.status === "void") {
    throw new Error("A void purchase order cannot be converted");
  }

  const lineRows = await dbPool
    .select()
    .from(purchaseOrderLineTable)
    .where(eq(purchaseOrderLineTable.purchaseOrderId, purchaseOrderId))
    .orderBy(purchaseOrderLineTable.sortOrder);

  if (lineRows.length === 0) {
    throw new Error("Purchase order has no lines to convert");
  }

  const bill = await createBillDraft({
    bookId,
    vendorId: purchaseOrder.vendorId,
    number: billNumber,
    billDate,
    dueDate,
    memo: purchaseOrder.memo,
    lines: lineRows.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      expenseAccountId: l.expenseAccountId,
      taxJurisdictionId: l.taxJurisdictionId,
    })),
  });

  await dbPool
    .update(purchaseOrderTable)
    .set({
      status: "converted",
      convertedBillId: bill.billId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(purchaseOrderTable.id, purchaseOrderId));

  return { purchaseOrderId, billId: bill.billId, alreadyConverted: false };
};
