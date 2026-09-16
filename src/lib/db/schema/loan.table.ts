import {
  index,
  integer,
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

export const loanTable = pgTable(
  "loan",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    liabilityAccountId: uuid("liability_account_id")
      .notNull()
      .references(() => accountTable.id),
    interestAccountId: uuid("interest_account_id")
      .notNull()
      .references(() => accountTable.id),
    paymentAccountId: uuid("payment_account_id")
      .notNull()
      .references(() => accountTable.id),
    originalPrincipal: numeric("original_principal", {
      precision: 19,
      scale: 4,
    }).notNull(),
    annualRate: numeric("annual_rate", { precision: 7, scale: 4 }).notNull(),
    termMonths: integer("term_months").notNull(),
    startDate: text("start_date").notNull(),
    paymentDay: integer("payment_day").notNull(),
    paymentAmount: numeric("payment_amount", { precision: 19, scale: 4 }),
    extraPrincipal: numeric("extra_principal", { precision: 19, scale: 4 })
      .notNull()
      .default("0.0000"),
    status: text().notNull().default("active"),
    notes: text(),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("loan_book_id_idx").on(table.bookId),
    index("loan_status_idx").on(table.status),
  ],
);

export type InsertLoan = InferInsertModel<typeof loanTable>;
export type SelectLoan = InferSelectModel<typeof loanTable>;
