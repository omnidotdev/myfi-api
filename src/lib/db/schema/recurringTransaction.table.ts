import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const recurringTransactionTable = pgTable(
  "recurring_transaction",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    frequency: recurringFrequencyEnum().notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    counterAccountId: uuid("counter_account_id").references(
      () => accountTable.id,
    ),
    isAutoDetected: boolean("is_auto_detected").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    nextExpectedDate: timestamp("next_expected_date", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("recurring_transaction_book_id_idx").on(table.bookId),
  ],
);

export type InsertRecurringTransaction = InferInsertModel<
  typeof recurringTransactionTable
>;
export type SelectRecurringTransaction = InferSelectModel<
  typeof recurringTransactionTable
>;
