import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const payrollConnectionTable = pgTable(
  "payroll_connection",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    companyId: text("company_id"),
    lastSyncedAt: timestamp("last_synced_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    syncCursor: text("sync_cursor"),
    status: text().notNull().default("active"),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("payroll_connection_book_id_idx").on(table.bookId),
    index("payroll_connection_status_idx").on(table.status),
  ],
);

export type InsertPayrollConnection = InferInsertModel<
  typeof payrollConnectionTable
>;
export type SelectPayrollConnection = InferSelectModel<
  typeof payrollConnectionTable
>;
