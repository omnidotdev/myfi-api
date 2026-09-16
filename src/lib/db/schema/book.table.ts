import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const bookTable = pgTable(
  "book",
  {
    id: generateDefaultId(),
    organizationId: text("organization_id").notNull(),
    name: text().notNull(),
    type: text().notNull(),
    currency: text().notNull().default("USD"),
    fiscalYearStartMonth: integer("fiscal_year_start_month")
      .notNull()
      .default(1),
    // source of record for invoices/quotes/inventory (app-validated text):
    // "myfi" (native, standalone) or "mantle" (Mantle owns them; MyFi records
    // the accounting from Mantle CloudEvents). Guarantees a single SSOT per book
    invoiceSource: text("invoice_source").notNull().default("myfi"),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("book_organization_id_idx").on(table.organizationId),
  ],
);

export type InsertBook = InferInsertModel<typeof bookTable>;
export type SelectBook = InferSelectModel<typeof bookTable>;
