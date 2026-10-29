import {
  boolean,
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
import { inventoryItemTable } from "./inventoryItem.table";
import { invoiceTable } from "./invoice.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A tracked block of time. Billable entries for a customer can be grouped into
// an invoice, at which point invoiceId is set so they are not billed twice.
// serviceItemId optionally links the service (a non-inventory/service item)
export const timeEntryTable = pgTable(
  "time_entry",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "set null",
    }),
    serviceItemId: uuid("service_item_id").references(
      () => inventoryItemTable.id,
      { onDelete: "set null" },
    ),
    date: text().notNull(),
    hours: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    rate: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    description: text(),
    billable: boolean().notNull().default(true),
    // set when the entry has been billed onto an invoice
    invoiceId: uuid("invoice_id").references(() => invoiceTable.id, {
      onDelete: "set null",
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("time_entry_book_id_idx").on(table.bookId),
    index("time_entry_customer_id_idx").on(table.customerId),
  ],
);

export type InsertTimeEntry = InferInsertModel<typeof timeEntryTable>;
export type SelectTimeEntry = InferSelectModel<typeof timeEntryTable>;
