import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { billTable } from "./bill.table";
import { bookTable } from "./book.table";
import { vendorTable } from "./vendor.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A purchase order for a vendor. status is app-validated text:
// "open", "closed", "converted", "void".
// Purchase orders do not post to the ledger; they convert into a bill, which does
export const purchaseOrderTable = pgTable(
  "purchase_order",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorTable.id),
    number: text().notNull(),
    status: text().notNull().default("open"),
    date: text().notNull(),
    subtotal: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    total: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    memo: text(),
    // set when the purchase order has been converted into a bill
    convertedBillId: uuid("converted_bill_id").references(() => billTable.id, {
      onDelete: "set null",
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("purchase_order_book_id_idx").on(table.bookId),
    index("purchase_order_vendor_id_idx").on(table.vendorId),
    index("purchase_order_status_idx").on(table.status),
    uniqueIndex("purchase_order_book_number_idx").on(
      table.bookId,
      table.number,
    ),
  ],
);

export type InsertPurchaseOrder = InferInsertModel<typeof purchaseOrderTable>;
export type SelectPurchaseOrder = InferSelectModel<typeof purchaseOrderTable>;
