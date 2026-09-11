import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { connectedAccountTable } from "./connectedAccount.table";

export const quickbooksMigrationTable = pgTable(
  "quickbooks_migration",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccountTable.id, { onDelete: "cascade" }),
    status: text().notNull().default("pending"),
    periodStart: timestamp("period_start", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    periodEnd: timestamp("period_end", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    entriesImported: integer("entries_imported").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("quickbooks_migration_book_id_idx").on(table.bookId),
  ],
);
