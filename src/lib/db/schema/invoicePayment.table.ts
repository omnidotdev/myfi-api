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
import { invoiceTable } from "./invoice.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const invoicePaymentTable = pgTable(
  "invoice_payment",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoiceTable.id, { onDelete: "cascade" }),
    date: text().notNull(),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    // account the received funds debit (a cash/bank account)
    depositAccountId: uuid("deposit_account_id")
      .notNull()
      .references(() => accountTable.id),
    method: text(),
    reference: text(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("invoice_payment_book_id_idx").on(table.bookId),
    index("invoice_payment_invoice_id_idx").on(table.invoiceId),
  ],
);

export type InsertInvoicePayment = InferInsertModel<typeof invoicePaymentTable>;
export type SelectInvoicePayment = InferSelectModel<typeof invoicePaymentTable>;
