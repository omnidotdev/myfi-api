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

// A customer price level: a signed percentage adjustment applied to item base
// prices, e.g. -10 for a 10% wholesale discount or +15 for a 15% markup.
// Assigned to a customer so their invoices default to the adjusted prices
export const priceLevelTable = pgTable(
  "price_level",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    adjustmentPercent: numeric("adjustment_percent", {
      precision: 19,
      scale: 4,
    })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("price_level_book_id_idx").on(table.bookId),
  ],
);

export type InsertPriceLevel = InferInsertModel<typeof priceLevelTable>;
export type SelectPriceLevel = InferSelectModel<typeof priceLevelTable>;
