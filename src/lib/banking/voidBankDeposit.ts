import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  bankDepositTable,
  invoicePaymentTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking the reversal of a bank deposit */
const BANK_DEPOSIT_VOID_SOURCE = "bank_deposit_void";

interface VoidBankDepositResult {
  depositId: string;
  reversalEntryId: string;
}

/**
 * Void a bank deposit: post a reversing journal entry (debit Undeposited Funds,
 * credit the bank account) so the ledger nets to zero, mark the deposit void,
 * and release its grouped payments back to the undeposited pool so they can be
 * deposited again. Book-ownership guarded
 */
export const voidBankDeposit = async (
  depositId: string,
  bookId: string,
): Promise<VoidBankDepositResult> => {
  const [deposit] = await dbPool
    .select()
    .from(bankDepositTable)
    .where(eq(bankDepositTable.id, depositId));
  if (!deposit || deposit.bookId !== bookId) {
    throw new Error("Bank deposit not found");
  }
  if (deposit.status === "void") {
    throw new Error("Bank deposit is already void");
  }

  const [uf] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, "undeposited_funds"),
      ),
    )
    .limit(1);
  if (!uf) {
    throw new Error("Undeposited Funds account not found for this book");
  }

  return dbPool.transaction(async (tx) => {
    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date: deposit.date,
        memo: "Void bank deposit",
        source: BANK_DEPOSIT_VOID_SOURCE,
        sourceReferenceId: deposit.id,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the void journal entry");
    }

    // Reverse the original DR bank / CR undeposited funds
    await tx.insert(journalLineTable).values([
      {
        journalEntryId: entryRow.id,
        accountId: uf.id,
        debit: deposit.total,
        credit: "0.0000",
      },
      {
        journalEntryId: entryRow.id,
        accountId: deposit.bankAccountId,
        debit: "0.0000",
        credit: deposit.total,
      },
    ] satisfies InferInsertModel<typeof journalLineTable>[]);

    await tx
      .update(bankDepositTable)
      .set({ status: "void", updatedAt: new Date().toISOString() })
      .where(eq(bankDepositTable.id, deposit.id));

    // release the grouped payments back to Undeposited Funds
    await tx
      .update(invoicePaymentTable)
      .set({ bankDepositId: null })
      .where(eq(invoicePaymentTable.bankDepositId, deposit.id));

    return { depositId: deposit.id, reversalEntryId: entryRow.id };
  });
};
