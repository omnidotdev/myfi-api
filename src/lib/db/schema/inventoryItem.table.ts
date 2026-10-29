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
import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A tracked inventory item. quantityOnHand and averageCost are maintained by
// inventory transactions (weighted-average costing). The three accounts wire
// its postings: assetAccount (inventory asset, debited on receipt / credited on
// sale at cost), cogsAccount (debited on sale), incomeAccount (sales revenue)
export const inventoryItemTable = pgTable(
  "inventory_item",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    sku: text(),
    name: text().notNull(),
    description: text(),
    salePrice: numeric("sale_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    quantityOnHand: numeric("quantity_on_hand", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    averageCost: numeric("average_cost", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    // "inventory" (stock-tracked, needs asset + COGS accounts), "service", or
    // "non_inventory" (sold but not stock-tracked, no asset/COGS). App-validated
    itemType: text("item_type").notNull().default("inventory"),
    // optional low-stock threshold for inventory items
    reorderPoint: numeric("reorder_point", { precision: 19, scale: 4 }),
    // asset and COGS accounts are required for inventory items and null for
    // service/non-inventory items, which post no stock movement or COGS
    assetAccountId: uuid("asset_account_id").references(() => accountTable.id),
    cogsAccountId: uuid("cogs_account_id").references(() => accountTable.id),
    incomeAccountId: uuid("income_account_id")
      .notNull()
      .references(() => accountTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("inventory_item_book_id_idx").on(table.bookId),
  ],
);

export type InsertInventoryItem = InferInsertModel<typeof inventoryItemTable>;
export type SelectInventoryItem = InferSelectModel<typeof inventoryItemTable>;
