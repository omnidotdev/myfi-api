import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { tagGroupTable } from "./tagGroup.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const tagTable = pgTable(
  "tag",
  {
    id: generateDefaultId(),
    tagGroupId: uuid("tag_group_id")
      .notNull()
      .references(() => tagGroupTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    code: text(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("tag_tag_group_id_idx").on(table.tagGroupId),
  ],
);

export type InsertTag = InferInsertModel<typeof tagTable>;
export type SelectTag = InferSelectModel<typeof tagTable>;
