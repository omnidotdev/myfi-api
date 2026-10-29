import { and, eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a remittance to a sales-tax agency */
const SALES_TAX_PAYMENT_SOURCE = "sales_tax_payment";

interface SalesTaxPaymentResult {
  journalEntryId: string;
  amount: number;
}

/**
 * Record a sales-tax remittance to a tax agency: debit the jurisdiction's
 * tax-payable liability and credit the bank account the payment comes from. This
 * draws down the collected-tax liability that the sales-tax report tracks. The
 * jurisdiction and payment account must belong to the book and the date must be
 * in an open period
 */
export const recordSalesTaxPayment = async (params: {
  bookId: string;
  jurisdictionId: string;
  amount: number;
  paymentAccountId: string;
  date: string;
  memo?: string | null;
}): Promise<SalesTaxPaymentResult> => {
  const { bookId, jurisdictionId, amount, paymentAccountId, date, memo } =
    params;

  if (toUnits(amount) <= 0) {
    throw new Error("Payment amount must be positive");
  }

  const [jurisdiction] = await dbPool
    .select({
      taxPayableAccountId: taxJurisdictionTable.taxPayableAccountId,
      name: taxJurisdictionTable.name,
    })
    .from(taxJurisdictionTable)
    .where(
      and(
        eq(taxJurisdictionTable.id, jurisdictionId),
        eq(taxJurisdictionTable.bookId, bookId),
      ),
    );
  if (!jurisdiction) {
    throw new Error("Tax jurisdiction not found for this book");
  }

  const [paymentAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(and(eq(accountTable.id, paymentAccountId), eq(accountTable.bookId, bookId)))
    .limit(1);
  if (!paymentAccount) {
    throw new Error("Payment account not found for this book");
  }

  if (await isPeriodLocked(bookId, date)) {
    throw new Error("Cannot record a tax payment into a closed period");
  }

  return dbPool.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: memo ?? `Sales tax remittance: ${jurisdiction.name}`,
        source: SALES_TAX_PAYMENT_SOURCE,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entry) {
      throw new Error("Failed to write the tax-payment entry");
    }

    await tx.insert(journalLineTable).values([
      {
        journalEntryId: entry.id,
        accountId: jurisdiction.taxPayableAccountId,
        debit: amount.toFixed(4),
        credit: "0.0000",
      },
      {
        journalEntryId: entry.id,
        accountId: paymentAccountId,
        debit: "0.0000",
        credit: amount.toFixed(4),
      },
    ] satisfies InferInsertModel<typeof journalLineTable>[]);

    return { journalEntryId: entry.id, amount };
  });
};
