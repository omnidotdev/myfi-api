import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { generateDefaultDate, generateDefaultId } from "lib/db/util";
import { bookTable } from "./book.table";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const costBasisMethodEnum = pgEnum("cost_basis_method", [
  "fifo",
  "lifo",
  "hifo",
  "acb",
]);

export const cryptoAssetTable = pgTable(
  "crypto_asset",
  {
    id: generateDefaultId(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => bookTable.id, { onDelete: "cascade" }),
    symbol: text().notNull(),
    name: text().notNull(),
    walletAddress: text("wallet_address"),
    network: text(),
    balance: numeric({ precision: 28, scale: 18 }).notNull().default("0"),
    costBasisMethod: costBasisMethodEnum("cost_basis_method")
      .notNull()
      .default("fifo"),
    lastSyncedAt: timestamp("last_synced_at", {
      precision: 6,
      mode: "string",
      withTimezone: true,
    }),
    createdAt: generateDefaultDate(),
    updatedAt: generateDefaultDate(),
  },
  (table) => [
    uniqueIndex().on(table.id),
    index("crypto_asset_book_id_idx").on(table.bookId),
    index("crypto_asset_symbol_idx").on(table.symbol),
  ],
);

export type InsertCryptoAsset = InferInsertModel<typeof cryptoAssetTable>;
export type SelectCryptoAsset = InferSelectModel<typeof cryptoAssetTable>;
