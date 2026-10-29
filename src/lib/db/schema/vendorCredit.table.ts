import {
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { journalEntryTable } from "./journalEntry.table";
import { vendorTable } from "./vendor.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// A vendor credit (reduces what the business owes a vendor), the accounts-payable
// mirror of a customer credit memo. status is app-validated text: "draft"
// (unposted), "open" (posted, unapplied or partly applied), "applied" (fully
// applied to bills), "void". Posting debits Accounts Payable and credits the
// expense accounts, the reverse of a bill; applying it to a bill is a subledger
// allocation, since the AP debit already nets against the bill's AP credit in
// the ledger
export const vendorCreditTable = pgTable(
  "vendor_credit",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorTable.id),
    number: text().notNull(),
    status: text().notNull().default("draft"),
    date: text().notNull(),
    subtotal: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    total: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    // running total allocated to bills; the credit is fully applied when this
    // equals total
    amountApplied: numeric("amount_applied", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    currency: text().notNull().default("USD"),
    // home-currency units per one unit of `currency` at the credit date; the
    // ledger posts in the book's home currency converted at this rate. 1 for a
    // home-currency vendor credit
    exchangeRate: numeric("exchange_rate", { precision: 19, scale: 8 })
      .notNull()
      .default("1"),
    memo: text(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("vendor_credit_book_id_idx").on(table.bookId),
    index("vendor_credit_vendor_id_idx").on(table.vendorId),
    index("vendor_credit_status_idx").on(table.status),
    // vendor-credit numbers are unique per book
    uniqueIndex("vendor_credit_book_number_idx").on(table.bookId, table.number),
  ],
);

export type InsertVendorCredit = InferInsertModel<typeof vendorCreditTable>;
export type SelectVendorCredit = InferSelectModel<typeof vendorCreditTable>;
