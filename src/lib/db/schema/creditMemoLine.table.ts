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
import { creditMemoTable } from "./creditMemo.table";
import { inventoryItemTable } from "./inventoryItem.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const creditMemoLineTable = pgTable(
  "credit_memo_line",
  {
    id: generateDefaultId(),
    creditMemoId: uuid("credit_memo_id")
      .notNull()
      .references(() => creditMemoTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // optional line discount as a fraction (0.1 = 10% off), applied before tax
    discountPercent: numeric("discount_percent", { precision: 9, scale: 6 }),
    // income account the line's revenue debits (the credit memo reverses revenue)
    incomeAccountId: uuid("income_account_id")
      .notNull()
      .references(() => accountTable.id),
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
    ),
    // when set, posting the credit memo restocks this item (goods returned):
    // the line quantity is added back to stock at the item's weighted-average
    // cost, debiting the inventory asset and crediting COGS
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItemTable.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("credit_memo_line_credit_memo_id_idx").on(table.creditMemoId),
  ],
);

export type InsertCreditMemoLine = InferInsertModel<typeof creditMemoLineTable>;
export type SelectCreditMemoLine = InferSelectModel<typeof creditMemoLineTable>;
