import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { customFieldDefinitionTable } from "./customFieldDefinition.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A value for a custom field on a specific entity row. entityId is a polymorphic
// reference to the row named by the definition's entityType (customer, invoice,
// etc.), so it carries no FK. One value per (definition, entity)
export const customFieldValueTable = pgTable(
  "custom_field_value",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => customFieldDefinitionTable.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull(),
    value: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    uniqueIndex("custom_field_value_def_entity_idx").on(
      table.definitionId,
      table.entityId,
    ),
    index("custom_field_value_entity_idx").on(table.entityId),
    index("custom_field_value_book_id_idx").on(table.bookId),
  ],
);

export type InsertCustomFieldValue = InferInsertModel<
  typeof customFieldValueTable
>;
export type SelectCustomFieldValue = InferSelectModel<
  typeof customFieldValueTable
>;
