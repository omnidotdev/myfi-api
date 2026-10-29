import { eq, inArray } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  creditMemoTable,
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a credit-memo reversal */
const CREDIT_MEMO_VOID_SOURCE = "credit_memo_void";

interface VoidCreditMemoResult {
  creditMemoId: string;
  reversalEntryId: string | null;
  alreadyVoid: boolean;
}

/**
 * Void a credit memo. A draft (never posted) memo is simply marked void. A
 * posted, unapplied memo is reversed with a balanced entry (each original line
 * with its debit and credit swapped) in the given period, then marked void. A
 * memo with any amount applied to invoices is refused: unapply it first, so a
 * void never silently strands a settled invoice balance
 */
export const voidCreditMemo = async (
  creditMemoId: string,
  bookId: string,
  voidDate: string,
): Promise<VoidCreditMemoResult> => {
  const [memo] = await dbPool
    .select()
    .from(creditMemoTable)
    .where(eq(creditMemoTable.id, creditMemoId));

  if (!memo || memo.bookId !== bookId) {
    throw new Error("Credit memo not found");
  }
  if (memo.status === "void") {
    return { creditMemoId, reversalEntryId: null, alreadyVoid: true };
  }
  if (toUnits(Number(memo.amountApplied)) > 0) {
    throw new Error(
      "Cannot void a credit memo that is applied to invoices; unapply it first",
    );
  }

  // A draft was never posted, so there is nothing to reverse
  if (memo.status === "draft" || !memo.journalEntryId) {
    await dbPool
      .update(creditMemoTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(creditMemoTable.id, creditMemoId));
    return { creditMemoId, reversalEntryId: null, alreadyVoid: false };
  }

  if (await isPeriodLocked(bookId, voidDate)) {
    throw new Error("Cannot void a credit memo into a closed period");
  }

  const originalLines = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
      taxJurisdictionId: journalLineTable.taxJurisdictionId,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, memo.journalEntryId));

  // Original restock movements: reverse each (negate quantity) and pull the
  // restocked quantity back off hand, mirroring how a void invoice undoes its
  // stock movements
  const movements = await dbPool
    .select({
      itemId: inventoryTransactionTable.itemId,
      quantity: inventoryTransactionTable.quantity,
      unitCost: inventoryTransactionTable.unitCost,
    })
    .from(inventoryTransactionTable)
    .where(eq(inventoryTransactionTable.journalEntryId, memo.journalEntryId));

  const unstock: { itemId: string; newQuantityOnHand: number }[] = [];
  if (movements.length > 0) {
    const removeByItem = new Map<string, number>();
    for (const m of movements) {
      removeByItem.set(
        m.itemId,
        (removeByItem.get(m.itemId) ?? 0) - Number(m.quantity),
      );
    }
    const items = await dbPool
      .select({
        id: inventoryItemTable.id,
        quantityOnHand: inventoryItemTable.quantityOnHand,
      })
      .from(inventoryItemTable)
      .where(inArray(inventoryItemTable.id, [...removeByItem.keys()]));
    for (const item of items) {
      unstock.push({
        itemId: item.id,
        newQuantityOnHand:
          Number(item.quantityOnHand) + (removeByItem.get(item.id) ?? 0),
      });
    }
  }

  return dbPool.transaction(async (tx) => {
    const [reversal] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: voidDate,
        memo: `Void credit memo ${memo.number}`,
        source: CREDIT_MEMO_VOID_SOURCE,
        sourceReferenceId: creditMemoId,
        isReviewed: true,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!reversal) {
      throw new Error("Failed to write the credit-memo reversal");
    }

    await tx.insert(journalLineTable).values(
      originalLines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        // Swap sides to reverse the original posting
        debit: line.credit,
        credit: line.debit,
        taxJurisdictionId: line.taxJurisdictionId,
      })),
    );

    // Offsetting stock movements (negated quantity) and pull the restocked
    // quantity back off hand
    if (movements.length > 0) {
      await tx.insert(inventoryTransactionTable).values(
        movements.map((m) => ({
          bookId,
          itemId: m.itemId,
          date: voidDate,
          type: "adjustment",
          quantity: (-Number(m.quantity)).toFixed(4),
          unitCost: m.unitCost,
          note: `Void credit memo ${memo.number}`,
          journalEntryId: reversal.id,
        })),
      );
    }
    for (const u of unstock) {
      await tx
        .update(inventoryItemTable)
        .set({
          quantityOnHand: u.newQuantityOnHand.toFixed(4),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(inventoryItemTable.id, u.itemId));
    }

    await tx
      .update(creditMemoTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(creditMemoTable.id, creditMemoId));

    return {
      creditMemoId,
      reversalEntryId: reversal.id,
      alreadyVoid: false,
    };
  });
};
