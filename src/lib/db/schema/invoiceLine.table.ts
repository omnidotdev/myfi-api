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
import { inventoryItemTable } from "./inventoryItem.table";
import { invoiceTable } from "./invoice.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const invoiceLineTable = pgTable(
  "invoice_line",
  {
    id: generateDefaultId(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoiceTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // income account the line's revenue credits when posted
    incomeAccountId: uuid("income_account_id")
      .notNull()
      .references(() => accountTable.id),
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
    ),
    // when set, posting the invoice also posts COGS and decrements this item's
    // stock at its weighted-average cost
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItemTable.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("invoice_line_invoice_id_idx").on(table.invoiceId),
  ],
);

export type InsertInvoiceLine = InferInsertModel<typeof invoiceLineTable>;
export type SelectInvoiceLine = InferSelectModel<typeof invoiceLineTable>;
