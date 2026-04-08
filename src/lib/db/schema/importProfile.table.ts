import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const importProfileTable = pgTable("import_profile", {
  id: generateDefaultId(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => bookTable.id, { onDelete: "cascade" }),
  name: text().notNull(),
  columnMap: jsonb("column_map").notNull(),
  headerRows: text("header_rows").notNull().default("1"),
  createdAt: generateDefaultDate(),
  updatedAt: generateDefaultDate(),
});

export type InsertImportProfile = InferInsertModel<typeof importProfileTable>;
export type SelectImportProfile = InferSelectModel<typeof importProfileTable>;
