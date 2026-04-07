import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const bookAccessTable = pgTable(
  "book_access",
  {
    id: generateDefaultId(),
    bookId: text("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text().notNull(),
    invitedBy: text("invited_by"),
    invitedAt: timestamp("invited_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).defaultNow(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("book_access_book_user_idx").on(table.bookId, table.userId),
    index("book_access_user_id_idx").on(table.userId),
  ],
);

export type InsertBookAccess = InferInsertModel<typeof bookAccessTable>;
export type SelectBookAccess = InferSelectModel<typeof bookAccessTable>;
