import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { billPaymentTable, billTable, journalEntryTable } from "lib/db/schema";

interface VoidBillResult {
  billId: string;
  alreadyVoid: boolean;
}

/**
 * Void a bill: delete its journal entry (lines cascade) and mark it void.
 * Refused when payments exist. Mirror of voidInvoice
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

  return dbPool.transaction(async (tx) => {
    if (bill.journalEntryId) {
      await tx
        .delete(journalEntryTable)
        .where(eq(journalEntryTable.id, bill.journalEntryId));
    }

    await tx
      .update(billTable)
      .set({
        status: "void",
        journalEntryId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(billTable.id, billId));

    return { billId, alreadyVoid: false };
  });
};
