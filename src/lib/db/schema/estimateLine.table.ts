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
import { estimateTable } from "./estimate.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const estimateLineTable = pgTable(
  "estimate_line",
  {
    id: generateDefaultId(),
    estimateId: uuid("estimate_id")
      .notNull()
      .references(() => estimateTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    amount: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // income account the line carries over to the invoice on conversion
    incomeAccountId: uuid("income_account_id")
      .notNull()
      .references(() => accountTable.id),
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
    ),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("estimate_line_estimate_id_idx").on(table.estimateId),
  ],
);

export type InsertEstimateLine = InferInsertModel<typeof estimateLineTable>;
export type SelectEstimateLine = InferSelectModel<typeof estimateLineTable>;
