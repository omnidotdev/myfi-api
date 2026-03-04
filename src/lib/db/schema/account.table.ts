import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const accountSubTypeEnum = pgEnum("account_sub_type", [
  "cash",
  "bank",
  "accounts_receivable",
  "inventory",
  "crypto_wallet",
  "investment",
  "fixed_asset",
  "other_asset",
  "credit_card",
  "accounts_payable",
  "loan",
  "mortgage",
  "other_liability",
  "owners_equity",
  "retained_earnings",
  "other_equity",
  "sales",
  "service_revenue",
  "interest_income",
  "crypto_gains",
  "other_revenue",
  "cost_of_goods",
  "operating_expense",
  "payroll",
  "tax_expense",
  "crypto_losses",
  "other_expense",
]);

export const accountTable = pgTable(
  "account",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): any => accountTable.id, {
      onDelete: "set null",
    }),
    name: text().notNull(),
    code: text(),
    type: accountTypeEnum().notNull(),
    subType: accountSubTypeEnum("sub_type"),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("account_book_id_idx").on(table.bookId),
    index("account_parent_id_idx").on(table.parentId),
    index("account_type_idx").on(table.type),
  ],
);

export type InsertAccount = InferInsertModel<typeof accountTable>;
export type SelectAccount = InferSelectModel<typeof accountTable>;
