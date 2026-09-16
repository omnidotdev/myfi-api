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
import { journalEntryTable } from "./journalEntry.table";
import { loanTable } from "./loan.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const amortizationEntryTable = pgTable(
  "amortization_entry",
  {
    id: generateDefaultId(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loanTable.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    dueDate: text("due_date").notNull(),
    paymentAmount: numeric("payment_amount", {
      precision: 19,
      scale: 4,
    }).notNull(),
    principalAmount: numeric("principal_amount", {
      precision: 19,
      scale: 4,
    }).notNull(),
    interestAmount: numeric("interest_amount", {
      precision: 19,
      scale: 4,
    }).notNull(),
    extraPrincipal: numeric("extra_principal", { precision: 19, scale: 4 })
      .notNull()
      .default("0.0000"),
    balanceAfter: numeric("balance_after", {
      precision: 19,
      scale: 4,
    }).notNull(),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
      { onDelete: "set null" },
    ),
    status: text().notNull().default("scheduled"),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("amortization_entry_loan_id_idx").on(table.loanId),
    index("amortization_entry_status_idx").on(table.status),
    index("amortization_entry_due_date_idx").on(table.dueDate),
  ],
);

export type InsertAmortizationEntry = InferInsertModel<
  typeof amortizationEntryTable
>;
export type SelectAmortizationEntry = InferSelectModel<
  typeof amortizationEntryTable
>;
