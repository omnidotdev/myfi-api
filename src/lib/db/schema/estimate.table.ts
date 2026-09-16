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
import { invoiceTable } from "./invoice.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// An estimate (quote) for a customer. status is app-validated text:
// "draft", "sent", "accepted", "declined", "converted", "expired".
// Estimates do not post to the ledger; they convert into an invoice, which does
export const estimateTable = pgTable(
  "estimate",
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
    estimateDate: text("estimate_date").notNull(),
    expiryDate: text("expiry_date"),
    subtotal: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    total: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    memo: text(),
    terms: text(),
    // set when the estimate has been converted into an invoice
    convertedInvoiceId: uuid("converted_invoice_id").references(
      () => invoiceTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("estimate_book_id_idx").on(table.bookId),
    index("estimate_customer_id_idx").on(table.customerId),
    index("estimate_status_idx").on(table.status),
    uniqueIndex("estimate_book_number_idx").on(table.bookId, table.number),
  ],
);

export type InsertEstimate = InferInsertModel<typeof estimateTable>;
export type SelectEstimate = InferSelectModel<typeof estimateTable>;
