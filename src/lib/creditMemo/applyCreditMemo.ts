import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  creditMemoApplicationTable,
  creditMemoTable,
  invoiceTable,
} from "lib/db/schema";
import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface ApplyCreditMemoOptions {
  creditMemoId: string;
  invoiceId: string;
  /** Owning book, checked against both records to prevent cross-book writes */
  bookId: string;
  amount: number;
  date: string;
}

interface ApplyCreditMemoResult {
  applicationId: string;
  creditMemoStatus: "open" | "applied";
  invoiceStatus: "partial" | "paid";
  amountApplied: number;
}

/**
 * Apply a posted credit memo to a posted invoice for the same customer. This is
 * a subledger allocation only: the memo's AR credit already nets against the
 * invoice's AR debit in the ledger, so no journal entry is written. It records
 * the allocation, advances the invoice's settled amount and the memo's applied
 * amount, and updates both statuses. The allocation is capped at the smaller of
 * the memo's and the invoice's remaining balance so neither can be over-applied
 */
export const applyCreditMemo = async (
  opts: ApplyCreditMemoOptions,
): Promise<ApplyCreditMemoResult> => {
  const { creditMemoId, invoiceId, bookId, amount, date } = opts;

  const amountUnits = toUnits(amount);
  if (amountUnits <= 0) {
    throw new Error("Application amount must be positive");
  }

  return dbPool.transaction(async (tx) => {
    // Re-read both rows under a row lock inside the transaction so concurrent
    // applications cannot both allocate the same remaining balance
    const [memo] = await tx
      .select()
      .from(creditMemoTable)
      .where(eq(creditMemoTable.id, creditMemoId))
      .for("update");
    if (!memo || memo.bookId !== bookId) {
      throw new Error("Credit memo not found");
    }
    if (memo.status !== "open" && memo.status !== "applied") {
      throw new Error("Only a posted credit memo can be applied");
    }

    const [invoice] = await tx
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoiceId))
      .for("update");
    if (!invoice || invoice.bookId !== bookId) {
      throw new Error("Invoice not found");
    }
    if (invoice.customerId !== memo.customerId) {
      throw new Error("Credit memo and invoice belong to different customers");
    }
    if (invoice.status !== "open" && invoice.status !== "partial") {
      throw new Error("Only an open or partially paid invoice can take a credit");
    }

    const memoRemaining =
      toUnits(Number(memo.total)) - toUnits(Number(memo.amountApplied));
    const invoiceRemaining =
      toUnits(Number(invoice.total)) - toUnits(Number(invoice.amountPaid));
    if (amountUnits > memoRemaining) {
      throw new Error("Amount exceeds the credit memo's remaining balance");
    }
    if (amountUnits > invoiceRemaining) {
      throw new Error("Amount exceeds the invoice's remaining balance");
    }

    const [application] = await tx
      .insert(creditMemoApplicationTable)
      .values({
        bookId,
        creditMemoId,
        invoiceId,
        amount: amount.toFixed(4),
        date,
      } satisfies InferInsertModel<typeof creditMemoApplicationTable>)
      .returning();
    if (!application) {
      throw new Error("Failed to record the credit-memo application");
    }

    const newInvoicePaidUnits =
      toUnits(Number(invoice.amountPaid)) + amountUnits;
    const invoiceStatus =
      newInvoicePaidUnits >= toUnits(Number(invoice.total)) ? "paid" : "partial";
    await tx
      .update(invoiceTable)
      .set({
        amountPaid: fromUnits(newInvoicePaidUnits).toFixed(4),
        status: invoiceStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoiceTable.id, invoiceId));

    const newMemoAppliedUnits =
      toUnits(Number(memo.amountApplied)) + amountUnits;
    const creditMemoStatus =
      newMemoAppliedUnits >= toUnits(Number(memo.total)) ? "applied" : "open";
    await tx
      .update(creditMemoTable)
      .set({
        amountApplied: fromUnits(newMemoAppliedUnits).toFixed(4),
        status: creditMemoStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(creditMemoTable.id, creditMemoId));

    return {
      applicationId: application.id,
      creditMemoStatus,
      invoiceStatus,
      amountApplied: fromUnits(newMemoAppliedUnits),
    };
  });
};
