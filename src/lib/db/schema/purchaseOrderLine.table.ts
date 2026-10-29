import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { purchaseOrderTable } from "./purchaseOrder.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const purchaseOrderLineTable = pgTable(
  "purchase_order_line",
  {
    id: generateDefaultId(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrderTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // expense account the line carries over to the bill on conversion
    expenseAccountId: uuid("expense_account_id")
      .notNull()
      .references(() => accountTable.id),
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("purchase_order_line_purchase_order_id_idx").on(
      table.purchaseOrderId,
    ),
  ],
);

export type InsertPurchaseOrderLine = InferInsertModel<
  typeof purchaseOrderLineTable
>;
export type SelectPurchaseOrderLine = InferSelectModel<
  typeof purchaseOrderLineTable
>;
