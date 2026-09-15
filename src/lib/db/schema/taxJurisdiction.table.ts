import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const taxJurisdictionTable = pgTable(
  "tax_jurisdiction",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    code: text(),
    // tax rate as a fraction (e.g. 0.0825 for 8.25%), used to auto-compute tax
    // on invoice lines; null when the jurisdiction has no single flat rate
    rate: numeric({ precision: 9, scale: 6 }),
    filingFrequency: text("filing_frequency").notNull(),
    taxPayableAccountId: uuid("tax_payable_account_id")
      .notNull()
      .references(() => accountTable.id),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("tax_jurisdiction_book_id_idx").on(table.bookId),
  ],
);

export type InsertTaxJurisdiction = InferInsertModel<
  typeof taxJurisdictionTable
>;
export type SelectTaxJurisdiction = InferSelectModel<
  typeof taxJurisdictionTable
>;
