import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "pending_review",
  "approved",
  "adjusted",
  "rejected",
]);

export const reconciliationQueueTable = pgTable(
  "reconciliation_queue",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntryTable.id, { onDelete: "cascade" }),
    status: reconciliationStatusEnum().notNull().default("pending_review"),
    reviewedAt: timestamp("reviewed_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    reviewedBy: text("reviewed_by"),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("reconciliation_queue_book_id_idx").on(table.bookId),
    index("reconciliation_queue_status_idx").on(table.status),
  ],
);

export type InsertReconciliationQueue = InferInsertModel<
  typeof reconciliationQueueTable
>;
export type SelectReconciliationQueue = InferSelectModel<
  typeof reconciliationQueueTable
>;
