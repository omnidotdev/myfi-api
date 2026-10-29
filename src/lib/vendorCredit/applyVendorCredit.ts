import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  billTable,
  vendorCreditApplicationTable,
  vendorCreditTable,
} from "lib/db/schema";
import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface ApplyVendorCreditOptions {
  vendorCreditId: string;
  billId: string;
  /** Owning book, checked against both records to prevent cross-book writes */
  bookId: string;
  amount: number;
  date: string;
}

interface ApplyVendorCreditResult {
  applicationId: string;
  vendorCreditStatus: "open" | "applied";
  billStatus: "partial" | "paid";
  amountApplied: number;
}

/**
 * Apply a posted vendor credit to a posted bill for the same vendor. This is a
 * subledger allocation only: the credit's AP debit already nets against the
 * bill's AP credit in the ledger, so no journal entry is written. It records
 * the allocation, advances the bill's settled amount and the credit's applied
 * amount, and updates both statuses. The allocation is capped at the smaller of
 * the credit's and the bill's remaining balance so neither can be over-applied
 */
export const applyVendorCredit = async (
  opts: ApplyVendorCreditOptions,
): Promise<ApplyVendorCreditResult> => {
  const { vendorCreditId, billId, bookId, amount, date } = opts;

  const amountUnits = toUnits(amount);
  if (amountUnits <= 0) {
    throw new Error("Application amount must be positive");
  }

  return dbPool.transaction(async (tx) => {
    // Re-read both rows under a row lock inside the transaction so concurrent
    // applications cannot both allocate the same remaining balance
    const [credit] = await tx
      .select()
      .from(vendorCreditTable)
      .where(eq(vendorCreditTable.id, vendorCreditId))
      .for("update");
    if (!credit || credit.bookId !== bookId) {
      throw new Error("Vendor credit not found");
    }
    if (credit.status !== "open" && credit.status !== "applied") {
      throw new Error("Only a posted vendor credit can be applied");
    }

    const [bill] = await tx
      .select()
      .from(billTable)
      .where(eq(billTable.id, billId))
      .for("update");
    if (!bill || bill.bookId !== bookId) {
      throw new Error("Bill not found");
    }
    if (bill.vendorId !== credit.vendorId) {
      throw new Error("Vendor credit and bill belong to different vendors");
    }
    if (bill.status !== "open" && bill.status !== "partial") {
      throw new Error("Only an open or partially paid bill can take a credit");
    }

    const creditRemaining =
      toUnits(Number(credit.total)) - toUnits(Number(credit.amountApplied));
    const billRemaining =
      toUnits(Number(bill.total)) - toUnits(Number(bill.amountPaid));
    if (amountUnits > creditRemaining) {
      throw new Error("Amount exceeds the vendor credit's remaining balance");
    }
    if (amountUnits > billRemaining) {
      throw new Error("Amount exceeds the bill's remaining balance");
    }

    const [application] = await tx
      .insert(vendorCreditApplicationTable)
      .values({
        bookId,
        vendorCreditId,
        billId,
        amount: amount.toFixed(4),
        date,
      } satisfies InferInsertModel<typeof vendorCreditApplicationTable>)
      .returning();
    if (!application) {
      throw new Error("Failed to record the vendor-credit application");
    }

    const newBillPaidUnits = toUnits(Number(bill.amountPaid)) + amountUnits;
    const billStatus =
      newBillPaidUnits >= toUnits(Number(bill.total)) ? "paid" : "partial";
    await tx
      .update(billTable)
      .set({
        amountPaid: fromUnits(newBillPaidUnits).toFixed(4),
        status: billStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(billTable.id, billId));

    const newCreditAppliedUnits =
      toUnits(Number(credit.amountApplied)) + amountUnits;
    const vendorCreditStatus =
      newCreditAppliedUnits >= toUnits(Number(credit.total))
        ? "applied"
        : "open";
    await tx
      .update(vendorCreditTable)
      .set({
        amountApplied: fromUnits(newCreditAppliedUnits).toFixed(4),
        status: vendorCreditStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(vendorCreditTable.id, vendorCreditId));

    return {
      applicationId: application.id,
      vendorCreditStatus,
      billStatus,
      amountApplied: fromUnits(newCreditAppliedUnits),
    };
  });
};
