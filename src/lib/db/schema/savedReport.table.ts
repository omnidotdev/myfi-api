import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A memorized report: a named report type plus the saved parameters (date
// range, basis, filters) to re-run it. reportType is app-validated text matching
// a report route; params is an opaque JSON bag the report page interprets
export const savedReportTable = pgTable(
  "saved_report",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    reportType: text("report_type").notNull(),
    params: jsonb().notNull().default({}),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("saved_report_book_id_idx").on(table.bookId),
  ],
);

export type InsertSavedReport = InferInsertModel<typeof savedReportTable>;
export type SelectSavedReport = InferSelectModel<typeof savedReportTable>;
