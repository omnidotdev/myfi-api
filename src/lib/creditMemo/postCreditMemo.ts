import { and, asc, eq, inArray } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  creditMemoLineTable,
  creditMemoTable,
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import {
  applyLineDiscount,
  buildInvoicePostings,
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
} from "lib/invoicing/invoicePosting";
import { movementValue } from "lib/inventory/valuation";

import type { InferInsertModel } from "drizzle-orm";
import type { PricedLine } from "lib/invoicing/invoicePosting";

/** Journal-entry source marking a posted customer credit memo */
const CREDIT_MEMO_SOURCE = "credit_memo";

interface PostCreditMemoResult {
  creditMemoId: string;
  journalEntryId: string;
  total: number;
  /** True when the memo was already posted, so this call was a no-op */
  alreadyPosted: boolean;
}

/**
 * Post a draft credit memo to the ledger. A credit memo is the reverse of an
 * invoice: it debits each line's income account and each taxed line's
 * jurisdiction payable account (reversing revenue and collected tax) and
 * credits Accounts Receivable for the total, reducing what the customer owes.
 * The postings are built with the shared invoice builder and then flipped side
 * for side, so the balance invariant and per-jurisdiction tax tagging are
 * identical to invoice posting.
 *
 * Idempotent: a memo that is not draft is a no-op returning its journal entry.
 * Inventory restock on a credit memo is not modeled in this version
 */
export const postCreditMemo = async (
  creditMemoId: string,
  bookId: string,
): Promise<PostCreditMemoResult> => {
  const [memo] = await dbPool
    .select()
    .from(creditMemoTable)
    .where(eq(creditMemoTable.id, creditMemoId));

  if (!memo || memo.bookId !== bookId) {
    throw new Error("Credit memo not found");
  }

  if (memo.status !== "draft") {
    if (!memo.journalEntryId) {
      throw new Error("Credit memo is not draft but has no journal entry");
    }
    return {
      creditMemoId,
      journalEntryId: memo.journalEntryId,
      total: Number(memo.total),
      alreadyPosted: true,
    };
  }

  if (await isPeriodLocked(bookId, memo.date)) {
    throw new Error("Cannot post a credit memo into a closed period");
  }

  const lineRows = await dbPool
    .select({
      quantity: creditMemoLineTable.quantity,
      unitPrice: creditMemoLineTable.unitPrice,
      incomeAccountId: creditMemoLineTable.incomeAccountId,
      taxJurisdictionId: creditMemoLineTable.taxJurisdictionId,
      discountPercent: creditMemoLineTable.discountPercent,
      inventoryItemId: creditMemoLineTable.inventoryItemId,
      taxRate: taxJurisdictionTable.rate,
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
    })
    .from(creditMemoLineTable)
    .leftJoin(
      taxJurisdictionTable,
      eq(creditMemoLineTable.taxJurisdictionId, taxJurisdictionTable.id),
    )
    .where(eq(creditMemoLineTable.creditMemoId, creditMemoId));

  if (lineRows.length === 0) {
    throw new Error("Credit memo has no lines to post");
  }

  const [arAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, memo.bookId),
        eq(accountTable.subType, "accounts_receivable"),
        eq(accountTable.isActive, true),
      ),
    )
    .orderBy(asc(accountTable.createdAt))
    .limit(1);

  if (!arAccount) {
    throw new Error(
      "No active Accounts Receivable account exists for this book",
    );
  }

  const priced: PricedLine[] = lineRows.map((row) => {
    const amount = applyLineDiscount(
      computeLineAmount(Number(row.quantity), Number(row.unitPrice)),
      row.discountPercent === null ? null : Number(row.discountPercent),
    );
    const rate = row.taxRate === null ? 0 : Number(row.taxRate);
    const taxAmount = rate > 0 ? computeLineTax(amount, rate) : 0;
    return {
      amount,
      taxAmount,
      incomeAccountId: row.incomeAccountId,
      taxPayableAccountId: row.taxPayableAccountId,
      taxJurisdictionId: row.taxJurisdictionId,
    };
  });

  // Restock plan: sum the returned quantity per inventory item across lines, so
  // an item on several lines restocks once. Returned goods go back at the item's
  // current weighted-average cost, which leaves the average unchanged
  const returnedByItem = new Map<string, number>();
  for (const row of lineRows) {
    if (row.inventoryItemId) {
      returnedByItem.set(
        row.inventoryItemId,
        (returnedByItem.get(row.inventoryItemId) ?? 0) + Number(row.quantity),
      );
    }
  }
  const restockPlan: {
    itemId: string;
    quantity: number;
    unitCost: number;
    value: number;
    cogsAccountId: string;
    assetAccountId: string;
    newQuantityOnHand: number;
  }[] = [];
  if (returnedByItem.size > 0) {
    const items = await dbPool
      .select()
      .from(inventoryItemTable)
      .where(inArray(inventoryItemTable.id, [...returnedByItem.keys()]));
    const itemById = new Map(items.map((it) => [it.id, it]));
    for (const [itemId, quantity] of returnedByItem) {
      const item = itemById.get(itemId);
      if (!item || item.bookId !== memo.bookId) {
        throw new Error("Credit memo references an inventory item not in this book");
      }
      const unitCost = Number(item.averageCost);
      restockPlan.push({
        itemId,
        quantity,
        unitCost,
        value: movementValue(quantity, unitCost),
        cogsAccountId: item.cogsAccountId,
        assetAccountId: item.assetAccountId,
        newQuantityOnHand: Number(item.quantityOnHand) + quantity,
      });
    }
  }

  const totals = computeInvoiceTotals(priced);
  // Build invoice postings (DR AR, CR income, CR tax) then flip every side, so a
  // credit memo debits income and tax and credits AR while staying balanced
  const postings = buildInvoicePostings({
    arAccountId: arAccount.id,
    lines: priced,
  }).map((posting) => ({
    accountId: posting.accountId,
    debit: posting.credit,
    credit: posting.debit,
    taxJurisdictionId: posting.taxJurisdictionId,
  }));

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: memo.bookId,
        date: memo.date,
        memo: `Credit memo ${memo.number}`,
        source: CREDIT_MEMO_SOURCE,
        sourceReferenceId: creditMemoId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the credit-memo journal entry");
    }

    for (const posting of postings) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: posting.accountId,
        debit: posting.debit.toFixed(4),
        credit: posting.credit.toFixed(4),
        taxJurisdictionId: posting.taxJurisdictionId ?? null,
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    // Restock returned goods: the reverse of a sale's COGS. Debit the inventory
    // asset and credit COGS at the returned value (a self-balancing pair), record
    // the stock movement, and add the quantity back on hand
    for (const plan of restockPlan) {
      if (plan.value !== 0) {
        await tx.insert(journalLineTable).values({
          journalEntryId: entryRow.id,
          accountId: plan.assetAccountId,
          debit: plan.value.toFixed(4),
          credit: "0.0000",
        } satisfies InferInsertModel<typeof journalLineTable>);
        await tx.insert(journalLineTable).values({
          journalEntryId: entryRow.id,
          accountId: plan.cogsAccountId,
          debit: "0.0000",
          credit: plan.value.toFixed(4),
        } satisfies InferInsertModel<typeof journalLineTable>);
      }
      await tx.insert(inventoryTransactionTable).values({
        bookId: memo.bookId,
        itemId: plan.itemId,
        date: memo.date,
        type: "adjustment",
        quantity: plan.quantity.toFixed(4),
        unitCost: plan.unitCost.toFixed(4),
        note: `Credit memo ${memo.number}`,
        journalEntryId: entryRow.id,
      } satisfies InferInsertModel<typeof inventoryTransactionTable>);
      await tx
        .update(inventoryItemTable)
        .set({
          quantityOnHand: plan.newQuantityOnHand.toFixed(4),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(inventoryItemTable.id, plan.itemId));
    }

    await tx
      .update(creditMemoTable)
      .set({
        status: "open",
        subtotal: totals.subtotal.toFixed(4),
        taxAmount: totals.taxAmount.toFixed(4),
        total: totals.total.toFixed(4),
        journalEntryId: entryRow.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(creditMemoTable.id, creditMemoId));

    return {
      creditMemoId,
      journalEntryId: entryRow.id,
      total: totals.total,
      alreadyPosted: false,
    };
  });
};
