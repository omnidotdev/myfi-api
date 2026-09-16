import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { journalLineTable } from "./journalLine.table";
import { projectTable } from "./project.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const journalLineProjectTable = pgTable(
  "journal_line_project",
  {
    id: generateDefaultId(),
    journalLineId: uuid("journal_line_id")
      .notNull()
      .references(() => journalLineTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("journal_line_project_line_project_idx").on(
      table.journalLineId,
      table.projectId,
    ),
    index("journal_line_project_project_id_idx").on(table.projectId),
  ],
);

export type InsertJournalLineProject = InferInsertModel<
  typeof journalLineProjectTable
>;
export type SelectJournalLineProject = InferSelectModel<
  typeof journalLineProjectTable
>;
