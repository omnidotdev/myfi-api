import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { accountTable } from "./account.table";
import { bookTable } from "./book.table";

export const quickbooksAccountMapTable = pgTable(
  "quickbooks_account_map",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    qboAccountId: text("qbo_account_id").notNull(),
    qboAccountName: text("qbo_account_name"),
    qboAccountType: text("qbo_account_type"),
    myfiAccountId: uuid("myfi_account_id")
      .notNull()
      .references(() => accountTable.id),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex("quickbooks_account_map_book_qbo_idx").on(
      table.bookId,
      table.qboAccountId,
    ),
    index("quickbooks_account_map_book_id_idx").on(table.bookId),
  ],
);
