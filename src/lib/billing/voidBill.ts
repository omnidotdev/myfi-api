import { eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  billPaymentTable,
  billTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking the reversal of a voided bill */
const BILL_VOID_SOURCE = "bill_void";

interface VoidBillResult {
  billId: string;
  alreadyVoid: boolean;
}

/**
 * Void a bill by posting a dated reversing journal entry (each original line's
 * debit and credit swapped) in the current open period, rather than deleting
 * the original entry, so the audit trail is preserved and a closed period is
 * never silently mutated. Refused when payments exist. Mirror of voidInvoice
 */
export const voidBill = async (
  billId: string,
  bookId: string,
): Promise<VoidBillResult> => {
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
  if (bill.status === "void") {
    return { billId, alreadyVoid: true };
  }

  const payments = await dbPool
    .select({ id: billPaymentTable.id })
    .from(billPaymentTable)
    .where(eq(billPaymentTable.billId, billId));
  if (payments.length > 0) {
    throw new Error("Cannot void a bill that has payments");
  }

  // A draft bill never posted to the ledger: just mark it void
  if (!bill.journalEntryId) {
    await dbPool
      .update(billTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(billTable.id, billId));
    return { billId, alreadyVoid: false };
  }

  const voidDate = new Date().toISOString().slice(0, 10);
  if (await isPeriodLocked(bookId, voidDate)) {
    throw new Error("Cannot void into a closed period");
  }

  const originalLines = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, bill.journalEntryId));

  return dbPool.transaction(async (tx) => {
    const [reversal] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: voidDate,
        memo: `Void bill ${bill.number}`,
        source: BILL_VOID_SOURCE,
        sourceReferenceId: billId,
        isReviewed: true,
        vendorId: bill.vendorId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();

    await tx.insert(journalLineTable).values(
      originalLines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
      })),
    );

    await tx
      .update(billTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(billTable.id, billId));

    return { billId, alreadyVoid: false };
  });
};
