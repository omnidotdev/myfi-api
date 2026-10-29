import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { journalLineTable } from "./journalLine.table";
import { trackingCategoryTable } from "./trackingCategory.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Many-to-many link tagging a journal line with a tracking category (class or
// location), mirroring journal_line_project
export const journalLineTrackingCategoryTable = pgTable(
  "journal_line_tracking_category",
  {
    id: generateDefaultId(),
    journalLineId: uuid("journal_line_id")
      .notNull()
      .references(() => journalLineTable.id, { onDelete: "cascade" }),
    trackingCategoryId: uuid("tracking_category_id")
      .notNull()
      .references(() => trackingCategoryTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("journal_line_tracking_category_line_cat_idx").on(
      table.journalLineId,
      table.trackingCategoryId,
    ),
    index("journal_line_tracking_category_cat_id_idx").on(
      table.trackingCategoryId,
    ),
  ],
);

export type InsertJournalLineTrackingCategory = InferInsertModel<
  typeof journalLineTrackingCategoryTable
>;
export type SelectJournalLineTrackingCategory = InferSelectModel<
  typeof journalLineTrackingCategoryTable
>;
