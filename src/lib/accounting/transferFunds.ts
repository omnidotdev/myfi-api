import { and, eq, inArray } from "drizzle-orm";

import { isPeriodLocked } from "lib/accounting/periodLock";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

/** Journal-entry source marking a transfer between two of the book's accounts */
const TRANSFER_SOURCE = "transfer";

interface TransferResult {
  journalEntryId: string;
  amount: number;
}

/**
 * Transfer money between two of a book's accounts (e.g. checking to savings, or
 * to a credit card). Posts one balanced journal entry debiting the destination
 * and crediting the source, so it is recognized as a transfer rather than
 * income or expense. Both accounts must belong to the book, differ, and the
 * date must not fall in a closed period
 */
export const transferFunds = async (params: {
  bookId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  memo?: string | null;
}): Promise<TransferResult> => {
  const { bookId, fromAccountId, toAccountId, amount, date, memo } = params;

  if (toUnits(amount) <= 0) {
    throw new Error("Transfer amount must be positive");
  }
  if (fromAccountId === toAccountId) {
    throw new Error("Cannot transfer to the same account");
  }

  const accounts = await dbPool
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        inArray(accountTable.id, [fromAccountId, toAccountId]),
      ),
    );
  if (accounts.length !== 2) {
    throw new Error("Both accounts must belong to this book");
  }

  if (await isPeriodLocked(bookId, date)) {
    throw new Error("Cannot post a transfer into a closed period");
  }

  return dbPool.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntryTable)
      .values({
        bookId,
        date,
        memo: memo ?? "Transfer",
        source: TRANSFER_SOURCE,
      } satisfies InferInsertModel<typeof journalEntryTable>)
      .returning();
    if (!entry) {
      throw new Error("Failed to write the transfer entry");
    }

    await tx.insert(journalLineTable).values([
      {
        journalEntryId: entry.id,
        accountId: toAccountId,
        debit: amount.toFixed(4),
        credit: "0.0000",
      },
      {
        journalEntryId: entry.id,
        accountId: fromAccountId,
        debit: "0.0000",
        credit: amount.toFixed(4),
      },
    ] satisfies InferInsertModel<typeof journalLineTable>[]);

    return { journalEntryId: entry.id, amount };
  });
};
