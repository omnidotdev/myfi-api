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
import { inventoryItemTable } from "./inventoryItem.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// An inventory stock movement. type is app-validated text:
// "receipt" (stock in, quantity positive), "sale" (stock out, quantity
// negative), "adjustment" (manual correction). unitCost is the per-unit cost at
// the time of the movement (the average cost applied on a sale)
export const inventoryTransactionTable = pgTable(
  "inventory_transaction",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItemTable.id, { onDelete: "cascade" }),
    date: text().notNull(),
    type: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    note: text(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("inventory_transaction_book_id_idx").on(table.bookId),
    index("inventory_transaction_item_id_idx").on(table.itemId),
  ],
);

export type InsertInventoryTransaction = InferInsertModel<
  typeof inventoryTransactionTable
>;
export type SelectInventoryTransaction = InferSelectModel<
  typeof inventoryTransactionTable
>;
