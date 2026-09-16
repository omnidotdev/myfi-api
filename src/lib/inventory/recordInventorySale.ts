import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";
import { hasSufficientStock, movementValue } from "./valuation";

import type { InferInsertModel } from "drizzle-orm";

const SALE_SOURCE = "inventory_sale";

interface RecordInventorySaleOptions {
  itemId: string;
  bookId: string;
  quantity: number;
  date: string;
  note?: string | null;
}

interface RecordInventorySaleResult {
  transactionId: string;
  journalEntryId: string;
  cogs: number;
  quantityOnHand: number;
}

/**
 * Record the cost side of selling/shipping an inventory item: debit COGS and
 * credit the inventory-asset account at the item's current weighted-average cost
 * times the quantity, and reduce the quantity on hand. Revenue is recognized
 * separately via an invoice. Rejects overselling. Book-ownership guarded
 */
export const recordInventorySale = async (
  opts: RecordInventorySaleOptions,
): Promise<RecordInventorySaleResult> => {
  const { itemId, bookId, quantity, date, note } = opts;

  if (toUnits(quantity) <= 0) {
    throw new Error("Sale quantity must be positive");
  }

  const [item] = await dbPool
    .select()
    .from(inventoryItemTable)
    .where(eq(inventoryItemTable.id, itemId));
  if (!item || item.bookId !== bookId) {
    throw new Error("Inventory item not found");
  }

  if (!hasSufficientStock(Number(item.quantityOnHand), quantity)) {
    throw new Error("Not enough stock on hand");
  }

  const unitCost = Number(item.averageCost);
  const cogs = movementValue(quantity, unitCost);
  const newQty = Number(item.quantityOnHand) - quantity;

  return dbPool.transaction(async (tx) => {
    const [txnRow] = await tx
      .insert(inventoryTransactionTable)
      .values({
        bookId,
        itemId,
        date,
        type: "sale",
        quantity: (-quantity).toFixed(4),
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
        memo: `COGS: ${item.name}`,
        source: SALE_SOURCE,
        sourceReferenceId: txnRow.id,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the COGS journal entry");
    }

    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: item.cogsAccountId,
      debit: cogs.toFixed(4),
      credit: "0.0000",
    } satisfies InferInsertModel<typeof journalLineTable>);
    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: item.assetAccountId,
      debit: "0.0000",
      credit: cogs.toFixed(4),
    } satisfies InferInsertModel<typeof journalLineTable>);

    await tx
      .update(inventoryTransactionTable)
      .set({ journalEntryId: entryRow.id })
      .where(eq(inventoryTransactionTable.id, txnRow.id));

    await tx
      .update(inventoryItemTable)
      .set({
        quantityOnHand: newQty.toFixed(4),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventoryItemTable.id, itemId));

    return {
      transactionId: txnRow.id,
      journalEntryId: entryRow.id,
      cogs,
      quantityOnHand: newQty,
    };
  });
};
