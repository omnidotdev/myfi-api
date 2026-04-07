import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { journalLineTable } from "./journalLine.table";
import { tagTable } from "./tag.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalLineTagTable = pgTable(
  "journal_line_tag",
  {
    id: generateDefaultId(),
    journalLineId: uuid("journal_line_id")
      .notNull()
      .references(() => journalLineTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tagTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("journal_line_tag_line_tag_idx").on(
      table.journalLineId,
      table.tagId,
    ),
    index("journal_line_tag_tag_id_idx").on(table.tagId),
  ],
);

export type InsertJournalLineTag = InferInsertModel<typeof journalLineTagTable>;
export type SelectJournalLineTag = InferSelectModel<typeof journalLineTagTable>;
