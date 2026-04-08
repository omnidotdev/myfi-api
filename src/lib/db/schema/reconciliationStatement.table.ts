import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const reconciliationStatementTable = pgTable(
  "reconciliation_statement",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    statementDate: text("statement_date").notNull(),
    statementBalance: numeric("statement_balance", {
      precision: 19,
      scale: 4,
    }).notNull(),
    beginningBalance: numeric("beginning_balance", {
      precision: 19,
      scale: 4,
    }).notNull(),
    status: text().notNull().default("in_progress"),
    completedAt: timestamp("completed_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    discrepancy: numeric({ precision: 19, scale: 4 }),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("recon_stmt_book_id_idx").on(table.bookId),
    index("recon_stmt_account_id_idx").on(table.accountId),
  ],
);

export type InsertReconciliationStatement = InferInsertModel<
  typeof reconciliationStatementTable
>;
export type SelectReconciliationStatement = InferSelectModel<
  typeof reconciliationStatementTable
>;
