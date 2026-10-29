import { eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";
import { movementValue } from "./valuation";

import type { InferInsertModel } from "drizzle-orm";

const ADJUSTMENT_SOURCE = "inventory_adjustment";

interface AdjustInventoryResult {
  transactionId: string;
  journalEntryId: string | null;
  quantityOnHand: number;
}

/**
 * Adjust an inventory item's quantity on hand to a counted value (shrinkage,
 * breakage, or a recount). The difference is valued at the item's current
 * weighted-average cost: a decrease debits COGS and credits the inventory
 * asset, an increase does the reverse, so the asset always equals quantity x
 * average cost. The average cost is unchanged (units move at the current
 * average). Records an adjustment movement and a balanced journal entry; the
 * date must be in an open period
 */
export const adjustInventory = async (params: {
  itemId: string;
  bookId: string;
  newQuantityOnHand: number;
  date: string;
  note?: string | null;
}): Promise<AdjustInventoryResult> => {
  const { itemId, bookId, newQuantityOnHand, date, note } = params;

  if (newQuantityOnHand < 0) {
    throw new Error("Quantity on hand cannot be negative");
  }

  const [item] = await dbPool
    .select()
    .from(inventoryItemTable)
    .where(eq(inventoryItemTable.id, itemId));
  if (!item || item.bookId !== bookId) {
    throw new Error("Inventory item not found");
  }
  // service and non-inventory items carry no stock and no asset/COGS accounts
  const { assetAccountId, cogsAccountId } = item;
  if (item.itemType !== "inventory" || !assetAccountId || !cogsAccountId) {
    throw new Error("Stock movements apply to inventory items only");
  }

  if (await isPeriodLocked(bookId, date)) {
    throw new Error("Cannot adjust inventory in a closed period");
  }

  const currentQty = Number(item.quantityOnHand);
  const delta = newQuantityOnHand - currentQty;
  const unitCost = Number(item.averageCost);
  const value = movementValue(Math.abs(delta), unitCost);

  return dbPool.transaction(async (tx) => {
    const [txnRow] = await tx
      .insert(inventoryTransactionTable)
      .values({
        bookId,
        itemId,
        date,
        type: "adjustment",
        quantity: delta.toFixed(4),
        unitCost: unitCost.toFixed(4),
        note: note ?? null,
      } satisfies InferInsertModel<typeof inventoryTransactionTable>)
      .returning();
    if (!txnRow) {
      throw new Error("Failed to write the inventory transaction");
    }

    let journalEntryId: string | null = null;
    if (toUnits(value) !== 0) {
      const [entryRow] = await tx
        .insert(journalEntryTable)
        .values({
          bookId,
          date,
          memo: `Inventory adjustment: ${item.name}`,
          source: ADJUSTMENT_SOURCE,
          sourceReferenceId: txnRow.id,
        } satisfies InferInsertModel<typeof journalEntryTable>)
        .returning();
      if (!entryRow) {
        throw new Error("Failed to write the adjustment journal entry");
      }
      journalEntryId = entryRow.id;

      // Increase: DR asset / CR COGS. Decrease: DR COGS / CR asset
      const assetDebit = delta > 0;
      await tx.insert(journalLineTable).values([
        {
          journalEntryId: entryRow.id,
          accountId: assetDebit ? assetAccountId : cogsAccountId,
          debit: value.toFixed(4),
          credit: "0.0000",
        },
        {
          journalEntryId: entryRow.id,
          accountId: assetDebit ? cogsAccountId : assetAccountId,
          debit: "0.0000",
          credit: value.toFixed(4),
        },
      ] satisfies InferInsertModel<typeof journalLineTable>[]);

      await tx
        .update(inventoryTransactionTable)
        .set({ journalEntryId: entryRow.id })
        .where(eq(inventoryTransactionTable.id, txnRow.id));
    }

    await tx
      .update(inventoryItemTable)
      .set({
        quantityOnHand: newQuantityOnHand.toFixed(4),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventoryItemTable.id, itemId));

    return {
      transactionId: txnRow.id,
      journalEntryId,
      quantityOnHand: newQuantityOnHand,
    };
  });
};
