import { and, asc, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  invoicePaymentTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { resolveFxAccount } from "lib/accounting/fxAccount";
import { fromUnits, MONEY_SCALE, toUnits } from "./invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a customer invoice payment (receipt) */
const INVOICE_PAYMENT_SOURCE = "invoice_payment";

interface RecordInvoicePaymentOptions {
  invoiceId: string;
  /** Owning book, checked against the invoice to prevent cross-book writes */
  bookId: string;
  /** Payment amount in the invoice's currency */
  amount: number;
  /** Cash or bank account the received funds debit */
  depositAccountId: string;
  date: string;
  /**
   * Home-currency units per one unit of the invoice currency at the payment
   * date. Defaults to the invoice's own rate (so a home-currency payment, or a
   * foreign payment at an unchanged rate, books no FX gain/loss)
   */
  exchangeRate?: number | null;
  method?: string | null;
  reference?: string | null;
}

interface RecordInvoicePaymentResult {
  paymentId: string;
  journalEntryId: string;
  invoiceStatus: "partial" | "paid";
  amountPaid: number;
}

/**
 * Record a payment against a posted invoice: debit the deposit account and
 * credit Accounts Receivable, then advance the invoice's paid amount and status
 * (partial until the balance is cleared, then paid). Overpayment is rejected so
 * AR cannot go negative from a receipt. The invoice must be posted (open or
 * partial); a draft or void invoice cannot take a payment
 */
export const recordInvoicePayment = async (
  opts: RecordInvoicePaymentOptions,
): Promise<RecordInvoicePaymentResult> => {
  const {
    invoiceId,
    bookId,
    amount,
    depositAccountId,
    date,
    exchangeRate,
    method,
    reference,
  } = opts;

  if (toUnits(amount) <= 0) {
    throw new Error("Payment amount must be positive");
  }

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
  if (invoice.status !== "open" && invoice.status !== "partial") {
    throw new Error("Only a posted, unpaid invoice can take a payment");
  }

  const balanceDueUnits =
    toUnits(Number(invoice.total)) - toUnits(Number(invoice.amountPaid));
  if (toUnits(amount) > balanceDueUnits) {
    throw new Error("Payment exceeds the balance due");
  }

  const [depositAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.id, depositAccountId),
        eq(accountTable.bookId, bookId),
      ),
    )
    .limit(1);
  if (!depositAccount) {
    throw new Error("Deposit account not found for this book");
  }

  const [arAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
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

  return dbPool.transaction(async (tx) => {
    // Re-read the invoice under a row lock inside the transaction and recompute
    // the balance here. The outer read is only a fast-fail; without the lock two
    // concurrent payments both see the stale amountPaid, both pass the check,
    // and both post a receipt - leaving AR double-credited while the subledger
    // records a single payment. FOR UPDATE serializes them on the invoice row
    const [locked] = await tx
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoiceId))
      .for("update");
    if (!locked || locked.bookId !== bookId) {
      throw new Error("Invoice not found");
    }
    if (locked.status !== "open" && locked.status !== "partial") {
      throw new Error("Only a posted, unpaid invoice can take a payment");
    }

    const lockedBalanceDueUnits =
      toUnits(Number(locked.total)) - toUnits(Number(locked.amountPaid));
    if (toUnits(amount) > lockedBalanceDueUnits) {
      throw new Error("Payment exceeds the balance due");
    }

    const newPaidUnits = toUnits(Number(locked.amountPaid)) + toUnits(amount);
    const invoiceStatus: "partial" | "paid" =
      newPaidUnits >= toUnits(Number(locked.total)) ? "paid" : "partial";

    // Cash is received at the payment-date rate; AR was booked at the invoice
    // rate. Their difference in home currency is the realized FX gain/loss. The
    // payment amount is in the invoice currency; the deposit account is home
    const invoiceRate = Number(locked.exchangeRate) || 1;
    const paymentRate = exchangeRate != null ? exchangeRate : invoiceRate;
    const amountUnits = toUnits(amount);
    const cashHomeUnits = Math.round(amountUnits * paymentRate);
    const arHomeUnits = Math.round(amountUnits * invoiceRate);
    const fxUnits = arHomeUnits - cashHomeUnits;

    const [paymentRow] = await tx
      .insert(invoicePaymentTable)
      .values({
        bookId,
        invoiceId,
        date,
        amount: amount.toFixed(4),
        exchangeRate: paymentRate.toFixed(8),
        depositAccountId,
        method: method ?? null,
        reference: reference ?? null,
      } satisfies InferInsertModel<typeof invoicePaymentTable>)
      .returning();
    if (!paymentRow) {
      throw new Error("Failed to write the invoice payment");
    }

    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: `Payment for invoice ${invoice.number}`,
        source: INVOICE_PAYMENT_SOURCE,
        sourceReferenceId: paymentRow.id,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the payment journal entry");
    }

    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: depositAccountId,
      debit: fromUnits(cashHomeUnits).toFixed(4),
      credit: "0.0000",
    } satisfies InferInsertModel<typeof journalLineTable>);
    await tx.insert(journalLineTable).values({
      journalEntryId: entryRow.id,
      accountId: arAccount.id,
      debit: "0.0000",
      credit: fromUnits(arHomeUnits).toFixed(4),
    } satisfies InferInsertModel<typeof journalLineTable>);
    // A rate change between invoicing and payment is a realized FX gain/loss:
    // more AR relieved than cash received is a loss (debit), the reverse a gain
    if (fxUnits !== 0) {
      const fxAccountId = await resolveFxAccount(tx, bookId);
      await tx.insert(journalLineTable).values({
        journalEntryId: entryRow.id,
        accountId: fxAccountId,
        debit: fxUnits > 0 ? fromUnits(fxUnits).toFixed(4) : "0.0000",
        credit: fxUnits < 0 ? fromUnits(-fxUnits).toFixed(4) : "0.0000",
      } satisfies InferInsertModel<typeof journalLineTable>);
    }

    await tx
      .update(invoicePaymentTable)
      .set({ journalEntryId: entryRow.id })
      .where(eq(invoicePaymentTable.id, paymentRow.id));

    await tx
      .update(invoiceTable)
      .set({
        amountPaid: (newPaidUnits / MONEY_SCALE).toFixed(4),
        status: invoiceStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoiceTable.id, invoiceId));

    return {
      paymentId: paymentRow.id,
      journalEntryId: entryRow.id,
      invoiceStatus,
      amountPaid: newPaidUnits / MONEY_SCALE,
    };
  });
};
