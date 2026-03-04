import {
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { cryptoAssetTable } from "./cryptoAsset.table";
import { journalEntryTable } from "./journalEntry.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const cryptoLotTable = pgTable(
  "crypto_lot",
  {
    id: generateDefaultId(),
    cryptoAssetId: uuid("crypto_asset_id")
      .notNull()
      .references(() => cryptoAssetTable.id, { onDelete: "cascade" }),
    acquiredAt: timestamp("acquired_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }).notNull(),
    quantity: numeric({ precision: 28, scale: 18 }).notNull(),
    costPerUnit: numeric("cost_per_unit", {
      precision: 19,
      scale: 4,
    }).notNull(),
    remainingQuantity: numeric("remaining_quantity", {
      precision: 28,
      scale: 18,
    }).notNull(),
    disposedAt: timestamp("disposed_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    proceedsPerUnit: numeric("proceeds_per_unit", {
      precision: 19,
      scale: 4,
    }),
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntryTable.id,
    ),
    createdAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("crypto_lot_crypto_asset_id_idx").on(table.cryptoAssetId),
  ],
);

export type InsertCryptoLot = InferInsertModel<typeof cryptoLotTable>;
export type SelectCryptoLot = InferSelectModel<typeof cryptoLotTable>;
