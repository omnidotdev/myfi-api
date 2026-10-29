import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { customerTable } from "./customer.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// frequency is app-validated text (no pgEnum for business logic); the accepted
// values match the advanceDate helper's vocabulary: weekly, biweekly, monthly,
// quarterly, yearly
export const recurringInvoiceTable = pgTable(
  "recurring_invoice",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customerTable.id),
    // prefix applied to each generated invoice's number; the issue date is
    // appended to keep the per-book invoice number unique per occurrence
    numberPrefix: text("number_prefix").notNull().default("INV-"),
    frequency: text().notNull(),
    // next occurrence to generate, a YYYY-MM-DD date; the scheduler advances it
    // past the run date after generating
    nextRunDate: text("next_run_date").notNull(),
    // days added to each invoice's issue date to compute its due date
    dueInDays: integer("due_in_days").notNull().default(30),
    currency: text().notNull().default("USD"),
    memo: text(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("recurring_invoice_book_id_idx").on(table.bookId),
    index("recurring_invoice_customer_id_idx").on(table.customerId),
  ],
);

export type InsertRecurringInvoice = InferInsertModel<
  typeof recurringInvoiceTable
>;
export type SelectRecurringInvoice = InferSelectModel<
  typeof recurringInvoiceTable
>;
