import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const vehicleTable = pgTable(
  "vehicle",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    year: integer(),
    make: text(),
    model: text(),
    dateInService: text("date_in_service"),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("vehicle_book_id_idx").on(table.bookId),
  ],
);

export type InsertVehicle = InferInsertModel<typeof vehicleTable>;
export type SelectVehicle = InferSelectModel<typeof vehicleTable>;
