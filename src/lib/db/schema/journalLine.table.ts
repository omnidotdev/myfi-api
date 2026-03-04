import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { generateDefaultId } from "lib/db/util";

import { accountTable } from "./account.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalLineTable = pgTable(
  "journal_line",
  {
    id: generateDefaultId(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntryTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountTable.id),
    debit: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    credit: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    memo: text(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("journal_line_entry_id_idx").on(table.journalEntryId),
    index("journal_line_account_id_idx").on(table.accountId),
  ],
);

export type InsertJournalLine = InferInsertModel<typeof journalLineTable>;
export type SelectJournalLine = InferSelectModel<typeof journalLineTable>;
