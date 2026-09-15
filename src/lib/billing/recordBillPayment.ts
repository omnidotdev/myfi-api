import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  billPaymentTable,
  billTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { MONEY_SCALE, toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a vendor bill payment */
const BILL_PAYMENT_SOURCE = "bill_payment";

interface RecordBillPaymentOptions {
  billId: string;
  bookId: string;
  amount: number;
  /** Cash or bank account the funds are paid from */
  paymentAccountId: string;
  date: string;
  method?: string | null;
  reference?: string | null;
}

interface RecordBillPaymentResult {
  paymentId: string;
  journalEntryId: string;
  billStatus: "partial" | "paid";
  amountPaid: number;
}

/**
 * Record a payment against a posted bill: debit Accounts Payable and credit the
 * payment account, then advance the bill's paid amount and status. Overpayment
 * is rejected. Mirror of recordInvoicePayment
 */
export const recordBillPayment = async (
  opts: RecordBillPaymentOptions,
): Promise<RecordBillPaymentResult> => {
  const { billId, bookId, amount, paymentAccountId, date, method, reference } =
    opts;

  if (toUnits(amount) <= 0) {
    throw new Error("Payment amount must be positive");
  }

  const [bill] = await dbPool
    .select()
    .from(billTable)
    .where(eq(billTable.id, billId));

  if (!bill) {
    throw new Error("Bill not found");
  }
  if (bill.bookId !== bookId) {
    throw new Error("Bill not found");
  }
  if (bill.status !== "open" && bill.status !== "partial") {
    throw new Error("Only a posted, unpaid bill can take a payment");
  }

  const balanceDueUnits =
    toUnits(Number(bill.total)) - toUnits(Number(bill.amountPaid));
  if (toUnits(amount) > balanceDueUnits) {
    throw new Error("Payment exceeds the balance due");
  }

  const [paymentAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, paymentAccountId),
        eq(accountTable.bookId, bookId),
      ),
    )
    .limit(1);
  if (!paymentAccount) {
    throw new Error("Payment account not found for this book");
  }

  const [apAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, "accounts_payable"),
        eq(accountTable.isActive, true),
      ),
    )
    .limit(1);
  if (!apAccount) {
    throw new Error("No active Accounts Payable account exists for this book");
  }

  const newPaidUnits = toUnits(Number(bill.amountPaid)) + toUnits(amount);
  const billStatus: "partial" | "paid" =
    newPaidUnits >= toUnits(Number(bill.total)) ? "paid" : "partial";

  return dbPool.transaction(async (tx) => {
    const [paymentRow] = await tx
      .insert(billPaymentTable)
      .values({
        bookId,
        billId,
        date,
        amount: amount.toFixed(4),
        paymentAccountId,
        method: method ?? null,
        reference: reference ?? null,
      } satisfies InferInsertModel<typeof billPaymentTable>)
      .returning();
    if (!paymentRow) {
      throw new Error("Failed to write the bill payment");
    }

    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: `Payment for bill ${bill.number}`,
        source: BILL_PAYMENT_SOURCE,
        sourceReferenceId: paymentRow.id,
        vendorId: bill.vendorId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the payment journal entry");
    }

    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: apAccount.id,
      debit: amount.toFixed(4),
      credit: "0.0000",
    } satisfies InferInsertModel<typeof journalLineTable>);
    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: paymentAccountId,
      debit: "0.0000",
      credit: amount.toFixed(4),
    } satisfies InferInsertModel<typeof journalLineTable>);

    await tx
      .update(billPaymentTable)
      .set({ journalEntryId: entryRow.id })
      .where(eq(billPaymentTable.id, paymentRow.id));

    await tx
      .update(billTable)
      .set({
        amountPaid: (newPaidUnits / MONEY_SCALE).toFixed(4),
        status: billStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(billTable.id, billId));

    return {
      paymentId: paymentRow.id,
      journalEntryId: entryRow.id,
      billStatus,
      amountPaid: newPaidUnits / MONEY_SCALE,
    };
  });
};
