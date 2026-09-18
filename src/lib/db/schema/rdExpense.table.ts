import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { projectTable } from "./project.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Captured qualified research expenses (QREs) for the R&D tax credit / section
 * 174 amortization worksheets. One row per expense line; the worksheet sums them
 * by year and category and splits domestic vs foreign (isForeign) research.
 */
export const rdExpenseTable = pgTable(
  "rd_expense",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    // tax year the expense belongs to
    year: integer().notNull(),
    // wages | supplies | contract_research | cloud_computing | other
    category: text().notNull().default("other"),
    description: text().notNull(),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    // foreign research is section 174 amortized over 15 years, not 5, so it is
    // captured and reported separately from domestic research
    isForeign: boolean("is_foreign").notNull().default(false),
    projectId: uuid("project_id").references(() => projectTable.id, {
      onDelete: "set null",
    }),
    notes: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("rd_expense_book_id_idx").on(table.bookId),
    index("rd_expense_book_year_idx").on(table.bookId, table.year),
    index("rd_expense_project_id_idx").on(table.projectId),
  ],
);

export type InsertRdExpense = InferInsertModel<typeof rdExpenseTable>;
export type SelectRdExpense = InferSelectModel<typeof rdExpenseTable>;
