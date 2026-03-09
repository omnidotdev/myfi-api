import {
  index,
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

export const connectedAccountTable = pgTable(
  "connected_account",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    providerAccountId: text("provider_account_id"),
    accountId: uuid("account_id").references(() => accountTable.id),
    institutionName: text("institution_name"),
    mask: text(),
    status: text().notNull().default("active"),
    accessToken: text("access_token"),
    lastSyncedAt: timestamp("last_synced_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    syncCursor: text("sync_cursor"),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("connected_account_book_id_idx").on(table.bookId),
    index("connected_account_provider_idx").on(table.provider),
  ],
);

export type InsertConnectedAccount = InferInsertModel<
  typeof connectedAccountTable
>;
export type SelectConnectedAccount = InferSelectModel<
  typeof connectedAccountTable
>;
