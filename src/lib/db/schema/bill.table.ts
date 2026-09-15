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
import { journalEntryTable } from "./journalEntry.table";
import { vendorTable } from "./vendor.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A vendor bill (accounts payable). status is app-validated text:
// "draft" (unposted), "open" (posted, unpaid), "partial", "paid", "void"
export const billTable = pgTable(
  "bill",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorTable.id),
    number: text().notNull(),
    status: text().notNull().default("draft"),
    billDate: text("bill_date").notNull(),
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
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("bill_book_id_idx").on(table.bookId),
    index("bill_vendor_id_idx").on(table.vendorId),
    index("bill_status_idx").on(table.status),
    // bill numbers are unique per book
    uniqueIndex("bill_book_number_idx").on(table.bookId, table.number),
  ],
);

export type InsertBill = InferInsertModel<typeof billTable>;
export type SelectBill = InferSelectModel<typeof billTable>;
