import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { recurringInvoiceTable } from "./recurringInvoice.table";
import { taxJurisdictionTable } from "./taxJurisdiction.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const recurringInvoiceLineTable = pgTable(
  "recurring_invoice_line",
  {
    id: generateDefaultId(),
    recurringInvoiceId: uuid("recurring_invoice_id")
      .notNull()
      .references(() => recurringInvoiceTable.id, { onDelete: "cascade" }),
    description: text().notNull(),
    quantity: numeric({ precision: 19, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    // income account each generated line's revenue credits when posted
    incomeAccountId: uuid("income_account_id")
      .notNull()
      .references(() => accountTable.id),
    taxJurisdictionId: uuid("tax_jurisdiction_id").references(
      () => taxJurisdictionTable.id,
    ),
    // optional line discount as a fraction (e.g. 0.100000 for 10% off), carried
    // onto each generated invoice line; null means no discount
    discountPercent: numeric("discount_percent", { precision: 9, scale: 6 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("recurring_invoice_line_recurring_invoice_id_idx").on(
      table.recurringInvoiceId,
    ),
  ],
);

export type InsertRecurringInvoiceLine = InferInsertModel<
  typeof recurringInvoiceLineTable
>;
export type SelectRecurringInvoiceLine = InferSelectModel<
  typeof recurringInvoiceLineTable
>;
