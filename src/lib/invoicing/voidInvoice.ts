import { eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  inventoryItemTable,
  inventoryTransactionTable,
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
 * lines cascade) and mark it void. Any inventory sold by the invoice is returned
 * to stock and its stock movements removed, so voiding fully reverses COGS and
 * quantity. Refused when payments exist, since a paid invoice must be handled
 * with a credit/refund rather than a silent void. A draft invoice (never posted)
 * is simply marked void with no ledger change
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

  // Plan any inventory restock: the invoice's stock movements are linked to its
  // journal entry, with quantity stored negative (a sale), so restoring adds the
  // absolute quantity back to the item on hand
  const restock: { itemId: string; newQuantityOnHand: number }[] = [];
  if (invoice.journalEntryId) {
    const movements = await dbPool
      .select({
        itemId: inventoryTransactionTable.itemId,
        quantity: inventoryTransactionTable.quantity,
      })
      .from(inventoryTransactionTable)
      .where(
        eq(inventoryTransactionTable.journalEntryId, invoice.journalEntryId),
      );

    const returnByItem = new Map<string, number>();
    for (const m of movements) {
      returnByItem.set(
        m.itemId,
        (returnByItem.get(m.itemId) ?? 0) - Number(m.quantity),
      );
    }
    if (returnByItem.size > 0) {
      const items = await dbPool
        .select({
          id: inventoryItemTable.id,
          quantityOnHand: inventoryItemTable.quantityOnHand,
        })
        .from(inventoryItemTable)
        .where(inArray(inventoryItemTable.id, [...returnByItem.keys()]));
      for (const item of items) {
        restock.push({
          itemId: item.id,
          newQuantityOnHand:
            Number(item.quantityOnHand) + (returnByItem.get(item.id) ?? 0),
        });
      }
    }
  }

  return dbPool.transaction(async (tx) => {
    for (const r of restock) {
      await tx
        .update(inventoryItemTable)
        .set({
          quantityOnHand: r.newQuantityOnHand.toFixed(4),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(inventoryItemTable.id, r.itemId));
    }

    if (invoice.journalEntryId) {
      // remove the stock movements tied to this invoice's entry, then the entry
      await tx
        .delete(inventoryTransactionTable)
        .where(
          eq(inventoryTransactionTable.journalEntryId, invoice.journalEntryId),
        );
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
