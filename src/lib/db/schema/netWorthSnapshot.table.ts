import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const netWorthSnapshotTable = pgTable(
  "net_worth_snapshot",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    date: timestamp({
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    totalAssets: numeric("total_assets", {
      precision: 19,
      scale: 4,
    }).notNull(),
    totalLiabilities: numeric("total_liabilities", {
      precision: 19,
      scale: 4,
    }).notNull(),
    netWorth: numeric("net_worth", { precision: 19, scale: 4 }).notNull(),
    breakdown: text(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("net_worth_snapshot_book_id_idx").on(table.bookId),
    index("net_worth_snapshot_date_idx").on(table.date),
  ],
);

export type InsertNetWorthSnapshot = InferInsertModel<
  typeof netWorthSnapshotTable
>;
export type SelectNetWorthSnapshot = InferSelectModel<
  typeof netWorthSnapshotTable
>;
