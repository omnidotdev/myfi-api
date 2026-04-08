import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";
import { vehicleTable } from "./vehicle.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const mileageLogTable = pgTable(
  "mileage_log",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicleTable.id, { onDelete: "cascade" }),
    date: text().notNull(),
    description: text(),
    origin: text(),
    destination: text(),
    odometerStart: numeric("odometer_start", {
      precision: 10,
      scale: 1,
    }),
    odometerEnd: numeric("odometer_end", { precision: 10, scale: 1 }),
    distance: numeric({ precision: 10, scale: 1 }).notNull(),
    isRoundTrip: boolean("is_round_trip").notNull().default(false),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("mileage_log_book_id_idx").on(table.bookId),
    index("mileage_log_vehicle_id_idx").on(table.vehicleId),
    index("mileage_log_date_idx").on(table.date),
  ],
);

export type InsertMileageLog = InferInsertModel<typeof mileageLogTable>;
export type SelectMileageLog = InferSelectModel<typeof mileageLogTable>;
