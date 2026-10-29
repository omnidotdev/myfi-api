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
import { taxJurisdictionTable } from "./taxJurisdiction.table";
import { vendorCreditTable } from "./vendorCredit.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const vendorCreditLineTable = pgTable(
  "vendor_credit_line",
  {
    id: generateDefaultId(),
    vendorCreditId: uuid("vendor_credit_id")
      .notNull()
      .references(() => vendorCreditTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // optional line discount as a fraction (0.1 = 10% off), applied before tax
    discountPercent: numeric("discount_percent", { precision: 9, scale: 6 }),
    // expense account the line's cost credits (the vendor credit reverses a bill)
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
    index("vendor_credit_line_vendor_credit_id_idx").on(table.vendorCreditId),
  ],
);

export type InsertVendorCreditLine = InferInsertModel<
  typeof vendorCreditLineTable
>;
export type SelectVendorCreditLine = InferSelectModel<
  typeof vendorCreditLineTable
>;
