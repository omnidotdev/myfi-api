import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A bundle: a named group of inventory/service items sold together. Adding a
// bundle to an invoice expands into one line per component, so the components
// post and decrement individually (a bundle itself holds no stock)
export const itemBundleTable = pgTable(
  "item_bundle",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("item_bundle_book_id_idx").on(table.bookId),
  ],
);

export type InsertItemBundle = InferInsertModel<typeof itemBundleTable>;
export type SelectItemBundle = InferSelectModel<typeof itemBundleTable>;
