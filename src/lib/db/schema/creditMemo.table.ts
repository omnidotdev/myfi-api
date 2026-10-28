import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { customerTable } from "./customer.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A customer credit memo (reduces what a customer owes). status is app-validated
// text: "draft" (unposted), "open" (posted, unapplied or partly applied),
// "applied" (fully applied to invoices), "void". Posting debits income and the
// tax-payable account and credits Accounts Receivable, the reverse of an
// invoice; applying it to an invoice is a subledger allocation, since the AR
// credit already nets against the invoice's AR debit in the ledger
export const creditMemoTable = pgTable(
  "credit_memo",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customerTable.id),
    number: text().notNull(),
    status: text().notNull().default("draft"),
    date: text().notNull(),
    subtotal: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    total: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // running total allocated to invoices; the memo is fully applied when this
    // equals total
    amountApplied: numeric("amount_applied", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    currency: text().notNull().default("USD"),
    memo: text(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("credit_memo_book_id_idx").on(table.bookId),
    index("credit_memo_customer_id_idx").on(table.customerId),
    index("credit_memo_status_idx").on(table.status),
    // credit-memo numbers are unique per book
    uniqueIndex("credit_memo_book_number_idx").on(table.bookId, table.number),
  ],
);

export type InsertCreditMemo = InferInsertModel<typeof creditMemoTable>;
export type SelectCreditMemo = InferSelectModel<typeof creditMemoTable>;
