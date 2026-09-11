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
import { quickbooksReconciliationTable } from "./quickbooksReconciliation.table";

export const quickbooksReconciliationLineTable = pgTable(
  "quickbooks_reconciliation_line",
  {
    id: generateDefaultId(),
    reconciliationId: uuid("reconciliation_id")
      .notNull()
      .references(() => quickbooksReconciliationTable.id, {
        onDelete: "cascade",
      }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    myfiAccountId: uuid("myfi_account_id").references(() => accountTable.id),
    qboAccountId: text("qbo_account_id"),
    accountName: text("account_name").notNull(),
    qboBalance: numeric("qbo_balance", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    myfiBalance: numeric("myfi_balance", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    variance: numeric({ precision: 19, scale: 4 }).notNull().default("0"),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("quickbooks_reconciliation_line_recon_id_idx").on(
      table.reconciliationId,
    ),
    index("quickbooks_reconciliation_line_book_id_idx").on(table.bookId),
  ],
);
