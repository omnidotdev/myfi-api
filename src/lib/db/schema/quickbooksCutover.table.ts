import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { connectedAccountTable } from "./connectedAccount.table";
import { quickbooksReconciliationTable } from "./quickbooksReconciliation.table";

export const quickbooksCutoverTable = pgTable(
  "quickbooks_cutover",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccountTable.id, { onDelete: "cascade" }),
    reconciliationId: uuid("reconciliation_id")
      .notNull()
      .references(() => quickbooksReconciliationTable.id),
    cutoverAt: timestamp("cutover_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    createdAt: generateDefaultDate(),
  },
  (table) => [uniqueIndex("quickbooks_cutover_book_id_idx").on(table.bookId)],
);
