import {
  index,
  numeric,
  pgTable,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { inventoryItemTable } from "./inventoryItem.table";
import { itemBundleTable } from "./itemBundle.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A component line of a bundle: an inventory/service item and the quantity of it
// the bundle contains
export const bundleComponentTable = pgTable(
  "bundle_component",
  {
    id: generateDefaultId(),
    bundleId: uuid("bundle_id")
      .notNull()
      .references(() => itemBundleTable.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItemTable.id, { onDelete: "cascade" }),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("bundle_component_bundle_id_idx").on(table.bundleId),
  ],
);

export type InsertBundleComponent = InferInsertModel<
  typeof bundleComponentTable
>;
export type SelectBundleComponent = InferSelectModel<
  typeof bundleComponentTable
>;
