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

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const vendorTable = pgTable(
  "vendor",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    businessName: text("business_name"),
    taxIdType: text("tax_id_type"),
    taxId: text("tax_id"),
    address: text(),
    city: text(),
    state: text(),
    zip: text(),
    email: text(),
    is1099Eligible: boolean("is_1099_eligible").notNull().default(true),
    threshold: numeric({ precision: 19, scale: 4 }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("vendor_book_id_idx").on(table.bookId),
  ],
);

export type InsertVendor = InferInsertModel<typeof vendorTable>;
export type SelectVendor = InferSelectModel<typeof vendorTable>;
