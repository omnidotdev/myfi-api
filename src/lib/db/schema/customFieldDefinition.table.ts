import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A user-defined custom field attached to an entity type. `entityType` and
// `fieldType` are app-validated text. entityType is one of customer, invoice,
// vendor, item; fieldType is text, number, date, or boolean. position orders
// the fields on a form
export const customFieldDefinitionTable = pgTable(
  "custom_field_definition",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    label: text().notNull(),
    fieldType: text("field_type").notNull().default("text"),
    position: integer().notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("custom_field_definition_book_entity_idx").on(
      table.bookId,
      table.entityType,
    ),
  ],
);

export type InsertCustomFieldDefinition = InferInsertModel<
  typeof customFieldDefinitionTable
>;
export type SelectCustomFieldDefinition = InferSelectModel<
  typeof customFieldDefinitionTable
>;
