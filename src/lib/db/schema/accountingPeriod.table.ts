import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const accountingPeriodTable = pgTable(
  "accounting_period",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    year: integer().notNull(),
    month: integer().notNull(),
    status: text().notNull().default("open"),
    closedAt: timestamp("closed_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    closedBy: text("closed_by"),
    reopenedAt: timestamp("reopened_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    blockers: jsonb(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("accounting_period_book_year_month_idx").on(
      table.bookId,
      table.year,
      table.month,
    ),
    index("accounting_period_status_idx").on(table.status),
  ],
);

export type InsertAccountingPeriod = InferInsertModel<
  typeof accountingPeriodTable
>;
export type SelectAccountingPeriod = InferSelectModel<
  typeof accountingPeriodTable
>;
