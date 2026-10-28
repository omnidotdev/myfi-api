import {
  boolean,
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
import { taxJurisdictionTable } from "./taxJurisdiction.table";

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
    cleared: boolean().notNull().default(false),
    // The tax jurisdiction a tax-payable posting belongs to. Set on invoice tax
    // credits (and their void reversals) so sales-tax collected/remitted can be
    // attributed per jurisdiction even when several jurisdictions share one GL
    // payable account. Null for every non-tax line and for legacy tax lines
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("journal_line_entry_id_idx").on(table.journalEntryId),
    index("journal_line_account_id_idx").on(table.accountId),
    index("journal_line_tax_jurisdiction_id_idx").on(table.taxJurisdictionId),
  ],
);

export type InsertJournalLine = InferInsertModel<typeof journalLineTable>;
export type SelectJournalLine = InferSelectModel<typeof journalLineTable>;
