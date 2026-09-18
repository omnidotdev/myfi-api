import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { vendorTable } from "./vendor.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Book-level document vault: entity records a bookkeeper or CPA needs on file
 * (articles, EIN letter, bylaws, tax returns, W9s, statements). Files live in
 * the private object-storage bucket; every read/write is proxied through the
 * API. Category is app-validated text (no pgEnum, per Drizzle conventions)
 */
export const documentTable = pgTable(
  "document",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    // articles | ein | bylaws | tax_return | w9 | statement | receipt | cap_table | other
    category: text().notNull().default("other"),
    name: text().notNull(),
    filename: text().notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    // W9s attach to a vendor; cleared (not cascaded) if the vendor is removed
    vendorId: uuid("vendor_id").references(() => vendorTable.id, {
      onDelete: "set null",
    }),
    // Tax year for returns/W9s (nullable)
    year: integer(),
    notes: text(),
    createdBy: text("created_by").notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("document_book_id_idx").on(table.bookId),
    index("document_category_idx").on(table.bookId, table.category),
    index("document_vendor_id_idx").on(table.vendorId),
  ],
);

export type InsertDocument = InferInsertModel<typeof documentTable>;
export type SelectDocument = InferSelectModel<typeof documentTable>;
