import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";
import { movementValue, newAverageCost } from "./valuation";

import type { InferInsertModel } from "drizzle-orm";

const RECEIPT_SOURCE = "inventory_receipt";

interface ReceiveStockOptions {
  itemId: string;
  bookId: string;
  quantity: number;
  unitCost: number;
  date: string;
  /** Account the purchase is funded from (cash/bank or accounts payable) */
  sourceAccountId: string;
  note?: string | null;
}

interface ReceiveStockResult {
  transactionId: string;
  journalEntryId: string;
  quantityOnHand: number;
  averageCost: number;
}

/**
 * Receive stock for an inventory item: debit the item's inventory-asset account
 * and credit the funding account for the purchase value, increase the quantity
 * on hand, and roll the weighted-average cost forward. Records an inventory
 * transaction for the movement. Book-ownership guarded
 */
export const receiveStock = async (
  opts: ReceiveStockOptions,
): Promise<ReceiveStockResult> => {
  const { itemId, bookId, quantity, unitCost, date, sourceAccountId, note } =
    opts;

  if (toUnits(quantity) <= 0) {
    throw new Error("Receive quantity must be positive");
  }
  if (toUnits(unitCost) < 0) {
    throw new Error("Unit cost cannot be negative");
  }

  const [item] = await dbPool
    .select()
    .from(inventoryItemTable)
    .where(eq(inventoryItemTable.id, itemId));
  if (!item || item.bookId !== bookId) {
    throw new Error("Inventory item not found");
  }

  const [source] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, sourceAccountId),
        eq(accountTable.bookId, bookId),
      ),
    )
    .limit(1);
  if (!source) {
    throw new Error("Source account not found for this book");
  }

  const value = movementValue(quantity, unitCost);
  const newQty = Number(item.quantityOnHand) + quantity;
  const newAvg = newAverageCost(
    Number(item.quantityOnHand),
    Number(item.averageCost),
    quantity,
    unitCost,
  );

  return dbPool.transaction(async (tx) => {
    const [txnRow] = await tx
      .insert(inventoryTransactionTable)
      .values({
        bookId,
        itemId,
        date,
        type: "receipt",
        quantity: quantity.toFixed(4),
        unitCost: unitCost.toFixed(4),
        note: note ?? null,
      } satisfies InferInsertModel<typeof inventoryTransactionTable>)
      .returning();
    if (!txnRow) {
      throw new Error("Failed to write the inventory transaction");
    }

    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: `Stock receipt: ${item.name}`,
        source: RECEIPT_SOURCE,
        sourceReferenceId: txnRow.id,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the receipt journal entry");
    }

    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: item.assetAccountId,
      debit: value.toFixed(4),
      credit: "0.0000",
    } satisfies InferInsertModel<typeof journalLineTable>);
    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: sourceAccountId,
      debit: "0.0000",
      credit: value.toFixed(4),
    } satisfies InferInsertModel<typeof journalLineTable>);

    await tx
      .update(inventoryTransactionTable)
      .set({ journalEntryId: entryRow.id })
      .where(eq(inventoryTransactionTable.id, txnRow.id));

    await tx
      .update(inventoryItemTable)
      .set({
        quantityOnHand: newQty.toFixed(4),
        averageCost: newAvg.toFixed(4),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventoryItemTable.id, itemId));

    return {
      transactionId: txnRow.id,
      journalEntryId: entryRow.id,
      quantityOnHand: newQty,
      averageCost: newAvg,
    };
  });
};
