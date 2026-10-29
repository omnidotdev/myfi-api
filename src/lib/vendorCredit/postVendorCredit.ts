import { and, asc, eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { buildBillPostings } from "lib/billing/billPosting";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
  vendorCreditLineTable,
  vendorCreditTable,
} from "lib/db/schema";
import {
  applyLineDiscount,
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
  fromUnits,
  toUnits,
} from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";
import type { PricedBillLine } from "lib/billing/billPosting";

/** Journal-entry source marking a posted vendor credit */
const VENDOR_CREDIT_SOURCE = "vendor_credit";

interface PostVendorCreditResult {
  vendorCreditId: string;
  journalEntryId: string;
  total: number;
  /** True when the credit was already posted, so this call was a no-op */
  alreadyPosted: boolean;
}

/**
 * Post a draft vendor credit to the ledger. A vendor credit is the reverse of a
 * bill: it debits Accounts Payable for the total and credits each line's expense
 * account, reducing what the business owes the vendor. The postings are built
 * with the shared bill builder (which, under US treatment, folds sales tax paid
 * into the expense debit rather than a separate tax-payable line) and then
 * flipped side for side, so the balance invariant is identical to bill posting.
 *
 * Idempotent: a credit that is not draft is a no-op returning its journal entry
 */
export const postVendorCredit = async (
  vendorCreditId: string,
  bookId: string,
): Promise<PostVendorCreditResult> => {
  const [credit] = await dbPool
    .select()
    .from(vendorCreditTable)
    .where(eq(vendorCreditTable.id, vendorCreditId));

  if (!credit || credit.bookId !== bookId) {
    throw new Error("Vendor credit not found");
  }

  if (credit.status !== "draft") {
    if (!credit.journalEntryId) {
      throw new Error("Vendor credit is not draft but has no journal entry");
    }
    return {
      vendorCreditId,
      journalEntryId: credit.journalEntryId,
      total: Number(credit.total),
      alreadyPosted: true,
    };
  }

  if (await isPeriodLocked(bookId, credit.date)) {
    throw new Error("Cannot post a vendor credit into a closed period");
  }

  const lineRows = await dbPool
    .select({
      quantity: vendorCreditLineTable.quantity,
      unitPrice: vendorCreditLineTable.unitPrice,
      expenseAccountId: vendorCreditLineTable.expenseAccountId,
      discountPercent: vendorCreditLineTable.discountPercent,
      taxRate: taxJurisdictionTable.rate,
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
    })
    .from(vendorCreditLineTable)
    .leftJoin(
      taxJurisdictionTable,
      eq(vendorCreditLineTable.taxJurisdictionId, taxJurisdictionTable.id),
    )
    .where(eq(vendorCreditLineTable.vendorCreditId, vendorCreditId));

  if (lineRows.length === 0) {
    throw new Error("Vendor credit has no lines to post");
  }

  const [apAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, credit.bookId),
        eq(accountTable.subType, "accounts_payable"),
        eq(accountTable.isActive, true),
      ),
    )
    // Deterministic pick so posting and application resolve the same AP account
    // if a book ever has more than one active one
    .orderBy(asc(accountTable.createdAt))
    .limit(1);

  if (!apAccount) {
    throw new Error("No active Accounts Payable account exists for this book");
  }

  const priced: PricedBillLine[] = lineRows.map((row) => {
    const amount = applyLineDiscount(
      computeLineAmount(Number(row.quantity), Number(row.unitPrice)),
      row.discountPercent === null ? null : Number(row.discountPercent),
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
  // Build bill postings (DR expense incl. tax, CR AP) then flip every side, so a
  // vendor credit debits AP and credits expense while staying balanced
  const postings = buildBillPostings({
    apAccountId: apAccount.id,
    lines: priced,
  }).map((posting) => ({
    accountId: posting.accountId,
    debit: posting.credit,
    credit: posting.debit,
  }));

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId: credit.bookId,
        date: credit.date,
        memo: `Vendor credit ${credit.number}`,
        source: VENDOR_CREDIT_SOURCE,
        sourceReferenceId: vendorCreditId,
        vendorId: credit.vendorId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the vendor-credit journal entry");
    }

    // Convert the expense credits and the AP debit from the credit currency to
    // the book's home currency at the credit rate. Each expense credit is
    // rounded to home currency and the single AP debit is set to their sum, so
    // the entry balances exactly. Rate 1 (a home-currency credit) is unchanged
    const rate = Number(credit.exchangeRate) || 1;
    let apHomeUnits = 0;
    for (const posting of postings) {
      if (posting.credit <= 0) continue;
      const homeUnits = Math.round(toUnits(posting.credit) * rate);
      apHomeUnits += homeUnits;
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: posting.accountId,
        debit: "0.0000",
        credit: fromUnits(homeUnits).toFixed(4),
      } satisfies InferInsertModel<typeof journalLineTable>);
    }
    const apPosting = postings.find((p) => p.debit > 0);
    if (apPosting) {
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: apPosting.accountId,
        debit: fromUnits(apHomeUnits).toFixed(4),
        credit: "0.0000",
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    await tx
      .update(vendorCreditTable)
      .set({
        status: "open",
        subtotal: totals.subtotal.toFixed(4),
        taxAmount: totals.taxAmount.toFixed(4),
        total: totals.total.toFixed(4),
        journalEntryId: entryRow.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(vendorCreditTable.id, vendorCreditId));

    return {
      vendorCreditId,
      journalEntryId: entryRow.id,
      total: totals.total,
      alreadyPosted: false,
    };
  });
};
