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
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const projectTable = pgTable(
  "project",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    code: text(),
    status: text().notNull().default("active"),
    budgetAmount: numeric("budget_amount", { precision: 19, scale: 4 }),
    startDate: timestamp("start_date", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    endDate: timestamp("end_date", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    notes: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("project_book_id_idx").on(table.bookId),
    index("project_status_idx").on(table.status),
  ],
);

export type InsertProject = InferInsertModel<typeof projectTable>;
export type SelectProject = InferSelectModel<typeof projectTable>;
