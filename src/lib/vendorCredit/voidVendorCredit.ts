import { eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  vendorCreditTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a vendor-credit reversal */
const VENDOR_CREDIT_VOID_SOURCE = "vendor_credit_void";

interface VoidVendorCreditResult {
  vendorCreditId: string;
  reversalEntryId: string | null;
  alreadyVoid: boolean;
}

/**
 * Void a vendor credit. A draft (never posted) credit is simply marked void. A
 * posted, unapplied credit is reversed with a balanced entry (each original line
 * with its debit and credit swapped) in the given period, then marked void. A
 * credit with any amount applied to bills is refused: unapply it first, so a
 * void never silently strands a settled bill balance
 */
export const voidVendorCredit = async (
  vendorCreditId: string,
  bookId: string,
  voidDate: string,
): Promise<VoidVendorCreditResult> => {
  const [credit] = await dbPool
    .select()
    .from(vendorCreditTable)
    .where(eq(vendorCreditTable.id, vendorCreditId));

  if (!credit || credit.bookId !== bookId) {
    throw new Error("Vendor credit not found");
  }
  if (credit.status === "void") {
    return { vendorCreditId, reversalEntryId: null, alreadyVoid: true };
  }
  if (toUnits(Number(credit.amountApplied)) > 0) {
    throw new Error(
      "Cannot void a vendor credit that is applied to bills; unapply it first",
    );
  }

  // A draft was never posted, so there is nothing to reverse
  if (credit.status === "draft" || !credit.journalEntryId) {
    await dbPool
      .update(vendorCreditTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(vendorCreditTable.id, vendorCreditId));
    return { vendorCreditId, reversalEntryId: null, alreadyVoid: false };
  }

  if (await isPeriodLocked(bookId, voidDate)) {
    throw new Error("Cannot void a vendor credit into a closed period");
  }

  const originalLines = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, credit.journalEntryId));

  return dbPool.transaction(async (tx) => {
    const [reversal] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: voidDate,
        memo: `Void vendor credit ${credit.number}`,
        source: VENDOR_CREDIT_VOID_SOURCE,
        sourceReferenceId: vendorCreditId,
        isReviewed: true,
        vendorId: credit.vendorId,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!reversal) {
      throw new Error("Failed to write the vendor-credit reversal");
    }

    await tx.insert(journalLineTable).values(
      originalLines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        // Swap sides to reverse the original posting
        debit: line.credit,
        credit: line.debit,
      })),
    );

    await tx
      .update(vendorCreditTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(vendorCreditTable.id, vendorCreditId));

    return {
      vendorCreditId,
      reversalEntryId: reversal.id,
      alreadyVoid: false,
    };
  });
};
