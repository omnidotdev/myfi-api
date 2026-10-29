import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { purchaseOrderTable } from "lib/db/schema";

/** Statuses a user can set directly (converted is set only by conversion) */
export type SettablePurchaseOrderStatus = "open" | "closed" | "void";

const SETTABLE: SettablePurchaseOrderStatus[] = ["open", "closed", "void"];

interface UpdatePurchaseOrderStatusResult {
  purchaseOrderId: string;
  status: SettablePurchaseOrderStatus;
}

/**
 * Transition a purchase order's status (open, close, void). A converted purchase
 * order is locked, since its bill already exists. Book-ownership guarded
 */
export const updatePurchaseOrderStatus = async (
  purchaseOrderId: string,
  bookId: string,
  status: SettablePurchaseOrderStatus,
): Promise<UpdatePurchaseOrderStatusResult> => {
  if (!SETTABLE.includes(status)) {
    throw new Error("Invalid purchase order status");
  }

  const [purchaseOrder] = await dbPool
    .select()
    .from(purchaseOrderTable)
    .where(eq(purchaseOrderTable.id, purchaseOrderId));

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }
  if (purchaseOrder.bookId !== bookId) {
    throw new Error("Purchase order not found");
  }
  if (purchaseOrder.status === "converted") {
    throw new Error("A converted purchase order cannot change status");
  }

  await dbPool
    .update(purchaseOrderTable)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(purchaseOrderTable.id, purchaseOrderId));

  return { purchaseOrderId, status };
};
