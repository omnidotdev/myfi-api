import {
  index,
  numeric,
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

export const savingsGoalTable = pgTable(
  "savings_goal",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    name: text().notNull(),
    targetAmount: numeric("target_amount", {
      precision: 19,
      scale: 4,
    }).notNull(),
    targetDate: timestamp("target_date", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("savings_goal_book_id_idx").on(table.bookId),
  ],
);

export type InsertSavingsGoal = InferInsertModel<typeof savingsGoalTable>;
export type SelectSavingsGoal = InferSelectModel<typeof savingsGoalTable>;
