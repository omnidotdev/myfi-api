import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  billLineTable,
  billTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import {
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
} from "lib/invoicing/invoicePosting";
import { buildBillPostings } from "./billPosting";

import type { InferInsertModel } from "drizzle-orm";
import type { PricedBillLine } from "./billPosting";

/** Journal-entry source marking a posted vendor bill */
const BILL_SOURCE = "bill";

interface PostBillResult {
  billId: string;
  journalEntryId: string;
  total: number;
  alreadyPosted: boolean;
}

/**
 * Post a draft bill to the ledger: credit the book's Accounts Payable for the
 * total and debit each line's expense account and each taxed line's jurisdiction
 * payable account (input tax). Mirror of postInvoice. Sets vendorId on the
 * journal entry so AP aging groups by vendor. Idempotent
 */
export const postBill = async (
  billId: string,
  bookId: string,
): Promise<PostBillResult> => {
  const [bill] = await dbPool
    .select()
    .from(billTable)
    .where(eq(billTable.id, billId));

  if (!bill) {
    throw new Error("Bill not found");
  }
  // Generic ownership guard (IDOR)
  if (bill.bookId !== bookId) {
    throw new Error("Bill not found");
  }

  if (bill.status !== "draft") {
    if (!bill.journalEntryId) {
      throw new Error("Bill is not draft but has no journal entry");
    }
    return {
      billId,
      journalEntryId: bill.journalEntryId,
      total: Number(bill.total),
      alreadyPosted: true,
    };
  }

  const lineRows = await dbPool
    .select({
      quantity: billLineTable.quantity,
      unitPrice: billLineTable.unitPrice,
      expenseAccountId: billLineTable.expenseAccountId,
      taxRate: taxJurisdictionTable.rate,
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
    })
    .from(billLineTable)
    .leftJoin(
      taxJurisdictionTable,
      eq(billLineTable.taxJurisdictionId, taxJurisdictionTable.id),
    )
    .where(eq(billLineTable.billId, billId));

  if (lineRows.length === 0) {
    throw new Error("Bill has no lines to post");
  }

  const [apAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bill.bookId),
        eq(accountTable.subType, "accounts_payable"),
        eq(accountTable.isActive, true),
      ),
    )
    .limit(1);

  if (!apAccount) {
    throw new Error("No active Accounts Payable account exists for this book");
  }

  const priced: PricedBillLine[] = lineRows.map((row) => {
    const amount = computeLineAmount(
      Number(row.quantity),
      Number(row.unitPrice),
    );
    const rate = row.taxRate === null ? 0 : Number(row.taxRate);
    const taxAmount = rate > 0 ? computeLineTax(amount, rate) : 0;
    return {
      amount,
      taxAmount,
      expenseAccountId: row.expenseAccountId,
      taxPayableAccountId: row.taxPayableAccountId,
    };
  });

  const totals = computeInvoiceTotals(
    priced.map((p) => ({
      amount: p.amount,
      taxAmount: p.taxAmount,
      incomeAccountId: p.expenseAccountId,
    })),
  );
  const postings = buildBillPostings({
    apAccountId: apAccount.id,
    lines: priced,
  });

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: bill.bookId,
        date: bill.billDate,
        memo: `Bill ${bill.number}`,
        source: BILL_SOURCE,
        sourceReferenceId: billId,
        vendorId: bill.vendorId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    if (!entryRow) {
      throw new Error("Failed to write the bill journal entry");
    }

    for (const posting of postings) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: posting.accountId,
        debit: posting.debit.toFixed(4),
        credit: posting.credit.toFixed(4),
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    await tx
      .update(billTable)
      .set({
        status: "open",
        subtotal: totals.subtotal.toFixed(4),
        taxAmount: totals.taxAmount.toFixed(4),
        total: totals.total.toFixed(4),
        journalEntryId: entryRow.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(billTable.id, billId));

    return {
      billId,
      journalEntryId: entryRow.id,
      total: totals.total,
      alreadyPosted: false,
    };
  });
};
