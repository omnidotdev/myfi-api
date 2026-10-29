import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { bookTable } from "./book.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A bank deposit groups one or more received payments that were held in
// Undeposited Funds into a single bank line, matching a real deposit slip. It
// posts DR bank / CR undeposited funds for the batch total. total is the sum in
// home currency of the grouped payments
export const bankDepositTable = pgTable(
  "bank_deposit",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    date: text().notNull(),
    // app-validated: "recorded" (posted) or "void" (reversed, payments released
    // back to Undeposited Funds)
    status: text().notNull().default("recorded"),
    // bank/cash account the batch lands in
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => accountTable.id),
    memo: text(),
    total: numeric({ precision: 19, scale: 4 }).notNull(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("bank_deposit_book_id_idx").on(table.bookId),
  ],
);

export type InsertBankDeposit = InferInsertModel<typeof bankDepositTable>;
export type SelectBankDeposit = InferSelectModel<typeof bankDepositTable>;
