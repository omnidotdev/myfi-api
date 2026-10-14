import { eq, inArray } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  inventoryItemTable,
  inventoryTransactionTable,
  invoicePaymentTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking the reversal of a voided invoice */
const INVOICE_VOID_SOURCE = "invoice_void";

interface VoidInvoiceResult {
  invoiceId: string;
  /** True when the invoice was already void, so this call was a no-op */
  alreadyVoid: boolean;
}

/**
 * Void an invoice by posting a dated reversing journal entry (each original
 * line's debit and credit swapped) in the current open period, rather than
 * deleting the original entry. Deleting would silently rewrite history and,
 * when the original sits in a closed period, mutate that closed period; a
 * reversal preserves the audit trail and leaves closed periods untouched. Any
 * inventory the invoice sold is returned to stock with offsetting movements, so
 * COGS and quantity reverse too. Refused when payments exist (handle with a
 * credit/refund). A draft invoice (never posted) is simply marked void
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

  // A draft invoice never posted to the ledger: just mark it void
  if (!invoice.journalEntryId) {
    await dbPool
      .update(invoiceTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(invoiceTable.id, invoiceId));
    return { invoiceId, alreadyVoid: false };
  }

  // The reversal posts in today's (open) period; refuse if that is closed
  const voidDate = new Date().toISOString().slice(0, 10);
  if (await isPeriodLocked(bookId, voidDate)) {
    throw new Error("Cannot void into a closed period");
  }

  // Original ledger lines, reversed (debit <-> credit) one-for-one
  const originalLines = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, invoice.journalEntryId));

  // Original stock movements: reverse each (negate quantity) and restock
  const movements = await dbPool
    .select({
      itemId: inventoryTransactionTable.itemId,
      quantity: inventoryTransactionTable.quantity,
      unitCost: inventoryTransactionTable.unitCost,
      date: inventoryTransactionTable.date,
    })
    .from(inventoryTransactionTable)
    .where(
      eq(inventoryTransactionTable.journalEntryId, invoice.journalEntryId),
    );

  const restock: { itemId: string; newQuantityOnHand: number }[] = [];
  if (movements.length > 0) {
    const returnByItem = new Map<string, number>();
    for (const m of movements) {
      returnByItem.set(
        m.itemId,
        (returnByItem.get(m.itemId) ?? 0) - Number(m.quantity),
      );
    }
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

  return dbPool.transaction(async (tx) => {
    const [reversal] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: voidDate,
        memo: `Void invoice ${invoice.number}`,
        source: INVOICE_VOID_SOURCE,
        sourceReferenceId: invoiceId,
        isReviewed: true,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    await tx.insert(journalLineTable).values(
      originalLines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        // Swap sides to reverse the original posting
        debit: line.credit,
        credit: line.debit,
      })),
    );

    // Offsetting stock movements (negated quantity) tied to the reversal, and
    // restock the on-hand quantity
    if (movements.length > 0) {
      await tx.insert(inventoryTransactionTable).values(
        movements.map((m) => ({
          bookId,
          itemId: m.itemId,
          date: voidDate,
          type: "adjustment",
          quantity: (-Number(m.quantity)).toFixed(4),
          unitCost: m.unitCost,
          note: `Void invoice ${invoice.number}`,
          journalEntryId: reversal.id,
        })),
      );
    }
    for (const r of restock) {
      await tx
        .update(inventoryItemTable)
        .set({
          quantityOnHand: r.newQuantityOnHand.toFixed(4),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(inventoryItemTable.id, r.itemId));
    }

    await tx
      .update(invoiceTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(invoiceTable.id, invoiceId));

    return { invoiceId, alreadyVoid: false };
  });
};
