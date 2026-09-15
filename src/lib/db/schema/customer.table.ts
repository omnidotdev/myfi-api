import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const customerTable = pgTable(
  "customer",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    businessName: text("business_name"),
    email: text(),
    phone: text(),
    address: text(),
    city: text(),
    state: text(),
    zip: text(),
    notes: text(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("customer_book_id_idx").on(table.bookId),
  ],
);

export type InsertCustomer = InferInsertModel<typeof customerTable>;
export type SelectCustomer = InferSelectModel<typeof customerTable>;
