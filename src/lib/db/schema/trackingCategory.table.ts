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

// A tracking-category value: QuickBooks-style Class or Location used to tag
// transactions for segment reporting. `kind` is app-validated text, "class" or
// "location". Values are flat per book (e.g. kind "location" -> "East", "West")
export const trackingCategoryTable = pgTable(
  "tracking_category",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    name: text().notNull(),
    code: text(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("tracking_category_book_id_idx").on(table.bookId),
    index("tracking_category_book_kind_idx").on(table.bookId, table.kind),
  ],
);

export type InsertTrackingCategory = InferInsertModel<
  typeof trackingCategoryTable
>;
export type SelectTrackingCategory = InferSelectModel<
  typeof trackingCategoryTable
>;
