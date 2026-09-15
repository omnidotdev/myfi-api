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

// status is app-validated text (no pgEnum for business logic):
// "draft" (unposted), "open" (posted, unpaid), "partial", "paid", "void"
export const invoiceTable = pgTable(
  "invoice",
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
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    subtotal: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    total: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    currency: text().notNull().default("USD"),
    memo: text(),
    terms: text(),
    // set when the invoice is posted to the ledger
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("invoice_book_id_idx").on(table.bookId),
    index("invoice_customer_id_idx").on(table.customerId),
    index("invoice_status_idx").on(table.status),
    // invoice numbers are unique per book
    uniqueIndex("invoice_book_number_idx").on(table.bookId, table.number),
  ],
);

export type InsertInvoice = InferInsertModel<typeof invoiceTable>;
export type SelectInvoice = InferSelectModel<typeof invoiceTable>;
