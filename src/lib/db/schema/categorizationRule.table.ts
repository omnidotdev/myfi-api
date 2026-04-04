import {
  index,
  integer,
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

export const categorizationRuleTable = pgTable(
  "categorization_rule",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    matchField: text("match_field").notNull(),
    matchType: text("match_type").notNull(),
    matchValue: text("match_value").notNull(),
    amountMin: numeric("amount_min", { precision: 19, scale: 4 }),
    amountMax: numeric("amount_max", { precision: 19, scale: 4 }),
    debitAccountId: uuid("debit_account_id")
      .notNull()
      .references(() => accountTable.id),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => accountTable.id),
    confidence: numeric({ precision: 3, scale: 2 }).notNull().default("1.00"),
    priority: integer().notNull().default(0),
    hitCount: integer("hit_count").notNull().default(0),
    lastHitAt: timestamp("last_hit_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("categorization_rule_book_id_idx").on(table.bookId),
    index("categorization_rule_match_field_idx").on(
      table.bookId,
      table.matchField,
    ),
  ],
);

export type InsertCategorizationRule = InferInsertModel<
  typeof categorizationRuleTable
>;
export type SelectCategorizationRule = InferSelectModel<
  typeof categorizationRuleTable
>;
