import { and, eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  bankDepositTable,
  invoicePaymentTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { MONEY_SCALE, fromUnits, toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a bank deposit of undeposited receipts */
const BANK_DEPOSIT_SOURCE = "bank_deposit";

interface CreateBankDepositOptions {
  bookId: string;
  date: string;
  /** The bank/cash account the batch lands in */
  bankAccountId: string;
  /** Payments currently held in Undeposited Funds to group into this deposit */
  paymentIds: string[];
  memo?: string | null;
}

interface CreateBankDepositResult {
  depositId: string;
  journalEntryId: string;
  /** Deposit total in home currency */
  total: number;
}

/**
 * Deposit receipts that are sitting in Undeposited Funds: post one journal
 * entry debiting the bank account and crediting Undeposited Funds for the batch
 * total, then stamp each grouped payment with the deposit id so it is relieved
 * from the undeposited pool. Only payments in this book that were held in
 * Undeposited Funds and not already deposited can be grouped
 */
export const createBankDeposit = async (
  opts: CreateBankDepositOptions,
): Promise<CreateBankDepositResult> => {
  const { bookId, date, bankAccountId, paymentIds, memo } = opts;

  if (paymentIds.length === 0) {
    throw new Error("A deposit must include at least one payment");
  }

  const [bankAccount] = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(eq(accountTable.id, bankAccountId), eq(accountTable.bookId, bookId)),
    )
    .limit(1);
  if (!bankAccount) {
    throw new Error("Bank account not found for this book");
  }

  // The undeposited-funds account must already exist (a payment was routed to
  // it). If not, no payment can be an undeposited receipt
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

  const payments = await dbPool
    .select()
    .from(invoicePaymentTable)
    .where(inArray(invoicePaymentTable.id, paymentIds));

  // Every requested payment must exist, belong to this book, sit in Undeposited
  // Funds, and not already be in a deposit. Reject the whole batch otherwise so
  // a partial or cross-book deposit can never post
  const available =
    uf !== undefined &&
    payments.length === paymentIds.length &&
    payments.every(
      (p) =>
        p.bookId === bookId &&
        p.bankDepositId === null &&
        p.depositAccountId === uf.id,
    );
  if (!available) {
    throw new Error(
      "One or more of the selected payments are not available to deposit",
    );
  }

  // Sum the receipts in home currency: each was debited to Undeposited Funds at
  // its own payment-date rate, so relieve the same home amount
  const totalUnits = payments.reduce(
    (sum, p) =>
      sum + Math.round(toUnits(Number(p.amount)) * Number(p.exchangeRate)),
    0,
  );
  const total = fromUnits(totalUnits);

  return dbPool.transaction(async (tx) => {
    const [depositRow] = await tx
      .insert(bankDepositTable)
      .values({
        bookId,
        date,
        bankAccountId,
        memo: memo ?? null,
        total: total.toFixed(4),
      } satisfies InferInsertModel<typeof bankDepositTable>)
      .returning();
    if (!depositRow) {
      throw new Error("Failed to write the bank deposit");
    }

    const [entryRow] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: memo ?? "Bank deposit",
        source: BANK_DEPOSIT_SOURCE,
        sourceReferenceId: depositRow.id,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entryRow) {
      throw new Error("Failed to write the deposit journal entry");
    }

    await tx.insert(journalLineTable).values([
      {
        journalEntryId: entryRow.id,
        accountId: bankAccountId,
        debit: total.toFixed(4),
        credit: "0.0000",
      },
      {
        journalEntryId: entryRow.id,
        accountId: uf.id,
        debit: "0.0000",
        credit: total.toFixed(4),
      },
    ] satisfies InferInsertModel<typeof journalLineTable>[]);

    await tx
      .update(bankDepositTable)
      .set({ journalEntryId: entryRow.id })
      .where(eq(bankDepositTable.id, depositRow.id));

    await tx
      .update(invoicePaymentTable)
      .set({ bankDepositId: depositRow.id })
      .where(inArray(invoicePaymentTable.id, paymentIds));

    return {
      depositId: depositRow.id,
      journalEntryId: entryRow.id,
      total: totalUnits / MONEY_SCALE,
    };
  });
};
