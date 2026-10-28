import { index, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { creditMemoTable } from "./creditMemo.table";
import { invoiceTable } from "./invoice.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// An allocation of a credit memo against an invoice. This is a subledger record
// only: the credit memo's AR credit already nets against the invoice's AR debit
// in the ledger when both are posted, so applying one to the other books no new
// journal entry, it just records how much of the memo settled which invoice
export const creditMemoApplicationTable = pgTable(
  "credit_memo_application",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    creditMemoId: uuid("credit_memo_id")
      .notNull()
      .references(() => creditMemoTable.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoiceTable.id, { onDelete: "cascade" }),
    amount: numeric({ precision: 19, scale: 4 }).notNull(),
    date: text().notNull(),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("credit_memo_application_credit_memo_id_idx").on(table.creditMemoId),
    index("credit_memo_application_invoice_id_idx").on(table.invoiceId),
  ],
);

export type InsertCreditMemoApplication = InferInsertModel<
  typeof creditMemoApplicationTable
>;
export type SelectCreditMemoApplication = InferSelectModel<
  typeof creditMemoApplicationTable
>;
