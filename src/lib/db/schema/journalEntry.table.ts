import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { vendorTable } from "./vendor.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalEntryTable = pgTable(
  "journal_entry",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    date: timestamp({
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    memo: text(),
    source: text().notNull().default("manual"),
    sourceReferenceId: text("source_reference_id"),
    isReviewed: boolean("is_reviewed").notNull().default(false),
    isReconciled: boolean("is_reconciled").notNull().default(false),
    vendorId: uuid("vendor_id").references(() => vendorTable.id, {
      onDelete: "set null",
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("journal_entry_book_id_idx").on(table.bookId),
    index("journal_entry_date_idx").on(table.date),
    index("journal_entry_source_idx").on(table.source),
    index("journal_entry_source_ref_idx").on(
      table.source,
      table.sourceReferenceId,
    ),
  ],
);

export type InsertJournalEntry = InferInsertModel<typeof journalEntryTable>;
export type SelectJournalEntry = InferSelectModel<typeof journalEntryTable>;
