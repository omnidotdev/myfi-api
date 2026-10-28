import { eq } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  creditMemoTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a credit-memo reversal */
const CREDIT_MEMO_VOID_SOURCE = "credit_memo_void";

interface VoidCreditMemoResult {
  creditMemoId: string;
  reversalEntryId: string | null;
  alreadyVoid: boolean;
}

/**
 * Void a credit memo. A draft (never posted) memo is simply marked void. A
 * posted, unapplied memo is reversed with a balanced entry (each original line
 * with its debit and credit swapped) in the given period, then marked void. A
 * memo with any amount applied to invoices is refused: unapply it first, so a
 * void never silently strands a settled invoice balance
 */
export const voidCreditMemo = async (
  creditMemoId: string,
  bookId: string,
  voidDate: string,
): Promise<VoidCreditMemoResult> => {
  const [memo] = await dbPool
    .select()
    .from(creditMemoTable)
    .where(eq(creditMemoTable.id, creditMemoId));

  if (!memo || memo.bookId !== bookId) {
    throw new Error("Credit memo not found");
  }
  if (memo.status === "void") {
    return { creditMemoId, reversalEntryId: null, alreadyVoid: true };
  }
  if (toUnits(Number(memo.amountApplied)) > 0) {
    throw new Error(
      "Cannot void a credit memo that is applied to invoices; unapply it first",
    );
  }

  // A draft was never posted, so there is nothing to reverse
  if (memo.status === "draft" || !memo.journalEntryId) {
    await dbPool
      .update(creditMemoTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(creditMemoTable.id, creditMemoId));
    return { creditMemoId, reversalEntryId: null, alreadyVoid: false };
  }

  if (await isPeriodLocked(bookId, voidDate)) {
    throw new Error("Cannot void a credit memo into a closed period");
  }

  const originalLines = await dbPool
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
      taxJurisdictionId: journalLineTable.taxJurisdictionId,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, memo.journalEntryId));

  return dbPool.transaction(async (tx) => {
    const [reversal] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: voidDate,
        memo: `Void credit memo ${memo.number}`,
        source: CREDIT_MEMO_VOID_SOURCE,
        sourceReferenceId: creditMemoId,
        isReviewed: true,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!reversal) {
      throw new Error("Failed to write the credit-memo reversal");
    }

    await tx.insert(journalLineTable).values(
      originalLines.map((line) => ({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        // Swap sides to reverse the original posting
        debit: line.credit,
        credit: line.debit,
        taxJurisdictionId: line.taxJurisdictionId,
      })),
    );

    await tx
      .update(creditMemoTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(creditMemoTable.id, creditMemoId));

    return {
      creditMemoId,
      reversalEntryId: reversal.id,
      alreadyVoid: false,
    };
  });
};
