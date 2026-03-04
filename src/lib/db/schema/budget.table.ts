import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const budgetPeriodEnum = pgEnum("budget_period", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const budgetTable = pgTable(
  "budget",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    period: budgetPeriodEnum().notNull().default("monthly"),
    rollover: boolean().notNull().default(false),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("budget_book_id_idx").on(table.bookId),
    index("budget_account_id_idx").on(table.accountId),
  ],
);

export type InsertBudget = InferInsertModel<typeof budgetTable>;
export type SelectBudget = InferSelectModel<typeof budgetTable>;
