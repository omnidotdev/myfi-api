import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const tagGroupTable = pgTable(
  "tag_group",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("tag_group_book_id_idx").on(table.bookId),
  ],
);

export type InsertTagGroup = InferInsertModel<typeof tagGroupTable>;
export type SelectTagGroup = InferSelectModel<typeof tagGroupTable>;
