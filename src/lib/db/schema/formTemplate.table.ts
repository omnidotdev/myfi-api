import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A custom form template (branding/layout) for a document type. documentType is
// app-validated text: "invoice" or "estimate". One template per documentType can
// be the default, applied when rendering that document
export const formTemplateTable = pgTable(
  "form_template",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    documentType: text("document_type").notNull().default("invoice"),
    accentColor: text("accent_color").notNull().default("#0f172a"),
    footerText: text("footer_text"),
    terms: text(),
    showLogo: boolean("show_logo").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("form_template_book_type_idx").on(table.bookId, table.documentType),
  ],
);

export type InsertFormTemplate = InferInsertModel<typeof formTemplateTable>;
export type SelectFormTemplate = InferSelectModel<typeof formTemplateTable>;
