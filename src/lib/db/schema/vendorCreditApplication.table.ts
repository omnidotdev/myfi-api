import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { billTable } from "./bill.table";
import { bookTable } from "./book.table";
import { vendorCreditTable } from "./vendorCredit.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// An allocation of a vendor credit against a bill. This is a subledger record
// only: the vendor credit's AP debit already nets against the bill's AP credit
// in the ledger when both are posted, so applying one to the other books no new
// journal entry, it just records how much of the credit settled which bill
export const vendorCreditApplicationTable = pgTable(
  "vendor_credit_application",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    vendorCreditId: uuid("vendor_credit_id")
      .notNull()
      .references(() => vendorCreditTable.id, { onDelete: "cascade" }),
    billId: uuid("bill_id")
      .notNull()
      .references(() => billTable.id, { onDelete: "cascade" }),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    date: text().notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("vendor_credit_application_vendor_credit_id_idx").on(
      table.vendorCreditId,
    ),
    index("vendor_credit_application_bill_id_idx").on(table.billId),
  ],
);

export type InsertVendorCreditApplication = InferInsertModel<
  typeof vendorCreditApplicationTable
>;
export type SelectVendorCreditApplication = InferSelectModel<
  typeof vendorCreditApplicationTable
>;
