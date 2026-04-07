import {
  index,
  integer,
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

export const fixedAssetTable = pgTable(
  "fixed_asset",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    assetAccountId: uuid("asset_account_id")
      .notNull()
      .references(() => accountTable.id),
    depreciationExpenseAccountId: uuid("depreciation_expense_account_id")
      .notNull()
      .references(() => accountTable.id),
    accumulatedDepreciationAccountId: uuid(
      "accumulated_depreciation_account_id",
    )
      .notNull()
      .references(() => accountTable.id),
    acquisitionDate: text("acquisition_date").notNull(),
    acquisitionCost: numeric("acquisition_cost", {
      precision: 19,
      scale: 4,
    }).notNull(),
    salvageValue: numeric("salvage_value", {
      precision: 19,
      scale: 4,
    })
      .notNull()
      .default("0.0000"),
    usefulLifeMonths: integer("useful_life_months").notNull(),
    depreciationMethod: text("depreciation_method").notNull(),
    macrsClass: text("macrs_class"),
    disposedAt: text("disposed_at"),
    disposalProceeds: numeric("disposal_proceeds", {
      precision: 19,
      scale: 4,
    }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("fixed_asset_book_id_idx").on(table.bookId),
    index("fixed_asset_disposed_idx").on(table.disposedAt),
  ],
);

export type InsertFixedAsset = InferInsertModel<typeof fixedAssetTable>;
export type SelectFixedAsset = InferSelectModel<typeof fixedAssetTable>;
