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
import { billTable } from "./bill.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const billLineTable = pgTable(
  "bill_line",
  {
    id: generateDefaultId(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => billTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // expense (or asset) account the line's cost debits when posted
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
    index("bill_line_bill_id_idx").on(table.billId),
  ],
);

export type InsertBillLine = InferInsertModel<typeof billLineTable>;
export type SelectBillLine = InferSelectModel<typeof billLineTable>;
