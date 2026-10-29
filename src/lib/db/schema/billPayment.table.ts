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
import { billTable } from "./bill.table";
import { bookTable } from "./book.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const billPaymentTable = pgTable(
  "bill_payment",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    billId: uuid("bill_id")
      .notNull()
      .references(() => billTable.id, { onDelete: "cascade" }),
    date: text().notNull(),
    // payment amount in the bill's currency
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    // home-currency units per one unit of the bill currency at the payment date;
    // the difference from the bill's rate is the realized FX gain/loss
    exchangeRate: numeric("exchange_rate", { precision: 19, scale: 8 })
      .notNull()
      .default("1"),
    // account the funds are paid from (a cash/bank account, in home currency)
    paymentAccountId: uuid("payment_account_id")
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
    index("bill_payment_book_id_idx").on(table.bookId),
    index("bill_payment_bill_id_idx").on(table.billId),
  ],
);

export type InsertBillPayment = InferInsertModel<typeof billPaymentTable>;
export type SelectBillPayment = InferSelectModel<typeof billPaymentTable>;
