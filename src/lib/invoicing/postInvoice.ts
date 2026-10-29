import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  inventoryItemTable,
  inventoryTransactionTable,
  invoiceLineTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { movementValue } from "lib/inventory/valuation";
import {
  applyLineDiscount,
  buildInvoicePostings,
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
  fromUnits,
  toUnits,
} from "./invoicePosting";

import type { InferInsertModel } from "drizzle-orm";
import type { LineTax, PricedLine } from "./invoicePosting";

/** Journal-entry source marking a posted customer invoice */
const INVOICE_SOURCE = "invoice";

interface PostInvoiceResult {
  invoiceId: string;
  journalEntryId: string;
  total: number;
  /** True when the invoice was already posted, so this call was a no-op */
  alreadyPosted: boolean;
}

/**
 * Post a draft invoice to the ledger: debit the book's Accounts Receivable for
 * the invoice total and credit each line's income account and each taxed line's
 * jurisdiction payable account, then mark the invoice open with its computed
 * totals. The ledger is the source of truth; the invoice subledger only records
 * what was posted.
 *
 * Idempotent: an invoice that is not in draft (already posted) is a no-op and
 * returns its existing journal entry. Line amounts are recomputed from quantity
 * times unit price and tax from the jurisdiction rate, so the posting reflects
 * the authoritative inputs rather than any stale stored amount
 */
export const postInvoice = async (
  invoiceId: string,
  bookId: string,
): Promise<PostInvoiceResult> => {
  const [invoice] = await dbPool
    .select()
    .from(invoiceTable)
    .where(eq(invoiceTable.id, invoiceId));

  if (!invoice) {
    throw new Error("Invoice not found");
  }
  // Generic ownership guard (IDOR): the invoice must belong to the caller's book
  if (invoice.bookId !== bookId) {
    throw new Error("Invoice not found");
  }

  if (invoice.status !== "draft") {
    if (!invoice.journalEntryId) {
      throw new Error("Invoice is not draft but has no journal entry");
    }
    return {
      invoiceId,
      journalEntryId: invoice.journalEntryId,
      total: Number(invoice.total),
      alreadyPosted: true,
    };
  }

  // Posting writes an AR/revenue entry dated at the issue date, so refuse a
  // closed period just like manual journal entries
  if (await isPeriodLocked(bookId, invoice.issueDate)) {
    throw new Error("Cannot post an invoice into a closed period");
  }

  // Lines joined to their primary and (optional) secondary tax jurisdiction for
  // the rates and payable accounts
  const secondaryTax = alias(taxJurisdictionTable, "secondary_tax");
  const lineRows = await dbPool
    .select({
      quantity: invoiceLineTable.quantity,
      unitPrice: invoiceLineTable.unitPrice,
      incomeAccountId: invoiceLineTable.incomeAccountId,
      inventoryItemId: invoiceLineTable.inventoryItemId,
      taxJurisdictionId: invoiceLineTable.taxJurisdictionId,
      discountPercent: invoiceLineTable.discountPercent,
      taxRate: taxJurisdictionTable.rate,
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
      secondaryTaxJurisdictionId: invoiceLineTable.secondaryTaxJurisdictionId,
      secondaryRate: secondaryTax.rate,
      secondaryPayableAccountId: secondaryTax.taxPayableAccountId,
      secondaryCompound: secondaryTax.compound,
    })
    .from(invoiceLineTable)
    .leftJoin(
      taxJurisdictionTable,
      eq(invoiceLineTable.taxJurisdictionId, taxJurisdictionTable.id),
    )
    .leftJoin(
      secondaryTax,
      eq(invoiceLineTable.secondaryTaxJurisdictionId, secondaryTax.id),
    )
    .where(eq(invoiceLineTable.invoiceId, invoiceId));

  if (lineRows.length === 0) {
    throw new Error("Invoice has no lines to post");
  }

  const [arAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, invoice.bookId),
        eq(accountTable.subType, "accounts_receivable"),
        eq(accountTable.isActive, true),
      ),
    )
    // Deterministic pick so posting and payment resolve the same AR account
    // if a book ever has more than one active one
    .orderBy(asc(accountTable.createdAt))
    .limit(1);

  if (!arAccount) {
    throw new Error(
      "No active Accounts Receivable account exists for this book",
    );
  }

  const priced: PricedLine[] = lineRows.map((row) => {
    // Net the line by its discount before taxing and crediting income, so the
    // posting matches the discounted subtotal the draft recorded
    const amount = applyLineDiscount(
      computeLineAmount(Number(row.quantity), Number(row.unitPrice)),
      row.discountPercent === null ? null : Number(row.discountPercent),
    );
    const rate = row.taxRate === null ? 0 : Number(row.taxRate);
    const taxes: LineTax[] = [];
    if (rate > 0 && row.taxPayableAccountId) {
      taxes.push({
        amount: computeLineTax(amount, rate),
        taxPayableAccountId: row.taxPayableAccountId,
        taxJurisdictionId: row.taxJurisdictionId,
      });
    }
    const secondaryRate =
      row.secondaryRate === null ? 0 : Number(row.secondaryRate);
    if (secondaryRate > 0 && row.secondaryPayableAccountId) {
      // A compound secondary tax is charged on the amount plus the primary tax
      // (tax-on-tax); otherwise it is a second flat tax on the amount alone
      const base = row.secondaryCompound
        ? amount + (taxes[0]?.amount ?? 0)
        : amount;
      taxes.push({
        amount: computeLineTax(base, secondaryRate),
        taxPayableAccountId: row.secondaryPayableAccountId,
        taxJurisdictionId: row.secondaryTaxJurisdictionId,
      });
    }
    const taxAmount = taxes.reduce((sum, t) => sum + t.amount, 0);
    return {
      amount,
      taxAmount,
      incomeAccountId: row.incomeAccountId,
      taxPayableAccountId: row.taxPayableAccountId,
      taxJurisdictionId: row.taxJurisdictionId,
      // Only carry the breakdown when there is a second tax; a single tax uses
      // the legacy fields unchanged
      taxes: taxes.length > 1 ? taxes : undefined,
    };
  });

  const totals = computeInvoiceTotals(priced);
  const postings = buildInvoicePostings({
    arAccountId: arAccount.id,
    lines: priced,
  });

  // Sum the quantity sold per inventory item across the invoice's lines, so an
  // item appearing on several lines posts one COGS entry and one stock movement
  const soldByItem = new Map<string, number>();
  for (const row of lineRows) {
    if (row.inventoryItemId) {
      soldByItem.set(
        row.inventoryItemId,
        (soldByItem.get(row.inventoryItemId) ?? 0) + Number(row.quantity),
      );
    }
  }

  // Plan the COGS postings and stock decrements from each item's current
  // weighted-average cost. Overselling into negative stock is allowed (matching
  // common accounting-software behavior) rather than blocking the invoice
  const cogsPlan: {
    itemId: string;
    quantity: number;
    unitCost: number;
    cogs: number;
    cogsAccountId: string;
    assetAccountId: string;
    newQuantityOnHand: number;
  }[] = [];
  if (soldByItem.size > 0) {
    const items = await dbPool
      .select()
      .from(inventoryItemTable)
      .where(inArray(inventoryItemTable.id, [...soldByItem.keys()]));
    const itemById = new Map(items.map((it) => [it.id, it]));
    for (const [itemId, quantity] of soldByItem) {
      const item = itemById.get(itemId);
      // an item on another book, or a stale reference, must not post here
      if (!item || item.bookId !== invoice.bookId) {
        throw new Error(
          "Invoice references an inventory item not in this book",
        );
      }
      // service and non-inventory items carry no stock: they post revenue only,
      // with no COGS pair or stock decrement
      if (
        item.itemType !== "inventory" ||
        !item.assetAccountId ||
        !item.cogsAccountId
      ) {
        continue;
      }
      const unitCost = Number(item.averageCost);
      cogsPlan.push({
        itemId,
        quantity,
        unitCost,
        cogs: movementValue(quantity, unitCost),
        cogsAccountId: item.cogsAccountId,
        assetAccountId: item.assetAccountId,
        newQuantityOnHand: Number(item.quantityOnHand) - quantity,
      });
    }
  }

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: invoice.bookId,
        date: invoice.issueDate,
        memo: `Invoice ${invoice.number}`,
        source: INVOICE_SOURCE,
        sourceReferenceId: invoiceId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    if (!entryRow) {
      throw new Error("Failed to write the invoice journal entry");
    }

    // Convert the AR/income/tax postings from the invoice currency to the book's
    // home currency at the invoice rate. The income and tax credits are each
    // rounded to home currency, and the single AR debit is set to their sum, so
    // the entry balances exactly despite per-line rounding. Rate 1 (a
    // home-currency invoice) leaves every amount unchanged
    const rate = Number(invoice.exchangeRate) || 1;
    let arHomeUnits = 0;
    for (const posting of postings) {
      if (posting.credit <= 0) continue;
      const homeUnits = Math.round(toUnits(posting.credit) * rate);
      arHomeUnits += homeUnits;
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: posting.accountId,
        debit: "0.0000",
        credit: fromUnits(homeUnits).toFixed(4),
        taxJurisdictionId: posting.taxJurisdictionId ?? null,
      } satisfies InferInsertModel<typeof journalLineTable>);
    }
    const arPosting = postings.find((p) => p.debit > 0);
    if (arPosting) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: arPosting.accountId,
        debit: fromUnits(arHomeUnits).toFixed(4),
        credit: "0.0000",
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    // Auto-COGS: for each inventory item sold, add a balanced DR COGS / CR
    // inventory-asset pair to the same entry, record the stock movement, and
    // decrement the item. The COGS pair is self-balancing so the entry stays
    // in balance
    for (const plan of cogsPlan) {
      if (plan.cogs !== 0) {
        await tx.insert(journalLineTable).values({
          journalEntryId: entryRow.id,
          accountId: plan.cogsAccountId,
          debit: plan.cogs.toFixed(4),
          credit: "0.0000",
        } satisfies InferInsertModel<typeof journalLineTable>);
        await tx.insert(journalLineTable).values({
          journalEntryId: entryRow.id,
          accountId: plan.assetAccountId,
          debit: "0.0000",
          credit: plan.cogs.toFixed(4),
        } satisfies InferInsertModel<typeof journalLineTable>);
      }
      await tx.insert(inventoryTransactionTable).values({
        bookId: invoice.bookId,
        itemId: plan.itemId,
        date: invoice.issueDate,
        type: "sale",
        quantity: (-plan.quantity).toFixed(4),
        unitCost: plan.unitCost.toFixed(4),
        note: `Invoice ${invoice.number}`,
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
      .update(invoiceTable)
      .set({
        status: "open",
        subtotal: totals.subtotal.toFixed(4),
        taxAmount: totals.taxAmount.toFixed(4),
        total: totals.total.toFixed(4),
        journalEntryId: entryRow.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoiceTable.id, invoiceId));

    return {
      invoiceId,
      journalEntryId: entryRow.id,
      total: totals.total,
      alreadyPosted: false,
    };
  });
};
