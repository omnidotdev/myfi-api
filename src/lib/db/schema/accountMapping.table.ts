import {
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const accountMappingTable = pgTable(
  "account_mapping",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    debitAccountId: uuid("debit_account_id")
      .notNull()
      .references(() => accountTable.id),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => accountTable.id),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("account_mapping_book_id_idx").on(table.bookId),
    index("account_mapping_event_type_idx").on(table.eventType),
  ],
);

export type InsertAccountMapping = InferInsertModel<
  typeof accountMappingTable
>;
export type SelectAccountMapping = InferSelectModel<
  typeof accountMappingTable
>;
