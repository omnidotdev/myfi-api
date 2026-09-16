import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const attachmentTable = pgTable(
  "attachment",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    filename: text().notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadStatus: text("upload_status").notNull().default("pending"),
    createdBy: text("created_by").notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("attachment_book_id_idx").on(table.bookId),
    index("attachment_journal_entry_id_idx").on(table.journalEntryId),
    index("attachment_upload_status_idx").on(table.uploadStatus),
  ],
);

export type InsertAttachment = InferInsertModel<typeof attachmentTable>;
export type SelectAttachment = InferSelectModel<typeof attachmentTable>;
