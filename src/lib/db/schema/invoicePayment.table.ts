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
import { bankDepositTable } from "./bankDeposit.table";
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
    // payment amount in the invoice's currency
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    // home-currency units per one unit of the invoice currency at the payment
    // date; the difference from the invoice's rate is the realized FX gain/loss
    exchangeRate: numeric("exchange_rate", { precision: 19, scale: 8 })
      .notNull()
      .default("1"),
    // account the received funds debit (a cash/bank account, in home currency)
    depositAccountId: uuid("deposit_account_id")
      .notNull()
      .references(() => accountTable.id),
    method: text(),
    reference: text(),
    // set once this payment is grouped into a bank deposit; null while the
    // payment is still sitting in Undeposited Funds, waiting to be deposited
    bankDepositId: uuid("bank_deposit_id").references(
      () => bankDepositTable.id,
      { onDelete: "set null" },
    ),
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
