import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable } from "lib/db/schema";
import { fetchHistoricalPrice, fetchPrices } from "./priceService";
import { fetchWalletBalance, validateWalletAddress } from "./walletService";

// Crypto REST routes for price feeds, wallet management, and asset tracking
const cryptoRoutes = new Elysia({ prefix: "/api/crypto" })
  .get(
    "/prices",
    async ({ query, set }) => {
      const { coins } = query;

      if (!coins) {
        set.status = 400;
        return { error: "coins query parameter is required" };
      }

      try {
        const prices = await fetchPrices(coins);
        return { prices };
      } catch (err) {
        set.status = 502;
        return {
          error: "Failed to fetch prices from CoinGecko",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      query: t.Object({
        coins: t.String(),
      }),
    },
  )
  .get(
    "/prices/history",
    async ({ query, set }) => {
      const { coin, date } = query;

      if (!coin || !date) {
        set.status = 400;
        return { error: "coin and date query parameters are required" };
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        set.status = 400;
        return { error: "date must be in YYYY-MM-DD format" };
      }

      try {
        const price = await fetchHistoricalPrice(coin, date);
        return { price };
      } catch (err) {
        set.status = 502;
        return {
          error: "Failed to fetch historical price from CoinGecko",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      query: t.Object({
        coin: t.String(),
        date: t.String(),
      }),
    },
  )
  .post(
    "/wallets",
    async ({ body, set }) => {
      const { bookId, symbol, name, walletAddress, network, balance } = body;

      // Validate wallet address if both address and network are provided
      if (walletAddress && network) {
        const validation = validateWalletAddress(walletAddress, network);

        if (!validation.valid) {
          set.status = 400;
          return { error: validation.error };
        }
      }

      const [asset] = await dbPool
        .insert(cryptoAssetTable)
        .values({
          bookId,
          symbol: symbol.toUpperCase(),
          name,
          walletAddress: walletAddress ?? null,
          network: network ?? null,
          balance: balance ?? "0",
        })
        .returning();

      set.status = 201;

      return { asset };
    },
    {
      body: t.Object({
        bookId: t.String(),
        symbol: t.String(),
        name: t.String(),
        walletAddress: t.Optional(t.String()),
        network: t.Optional(t.String()),
        balance: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/wallets",
    async ({ query, set }) => {
      const { bookId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId query parameter is required" };
      }

      const assets = await dbPool
        .select()
        .from(cryptoAssetTable)
        .where(eq(cryptoAssetTable.bookId, bookId));

      return { assets };
    },
    {
      query: t.Object({
        bookId: t.String(),
      }),
    },
  )
  .post(
    "/wallets/:id/refresh",
    async ({ params, set }) => {
      const { id } = params;

      const [asset] = await dbPool
        .select()
        .from(cryptoAssetTable)
        .where(eq(cryptoAssetTable.id, id));

      if (!asset) {
        set.status = 404;
        return { error: "Crypto asset not found" };
      }

      // Fetch latest price for the asset
      let currentPrice: number | null = null;

      try {
        const prices = await fetchPrices(asset.symbol.toLowerCase());
        const priceData = prices[asset.symbol.toLowerCase()];
        currentPrice = priceData?.usd ?? null;
      } catch {
        // Price fetch is best-effort; continue with balance refresh
      }

      // Refresh on-chain balance if wallet address is tracked
      let updatedBalance = asset.balance;

      if (asset.walletAddress && asset.network) {
        const walletData = await fetchWalletBalance(
          asset.walletAddress,
          asset.network,
          asset.balance,
        );

        updatedBalance = walletData.balance;
      }

      const [updated] = await dbPool
        .update(cryptoAssetTable)
        .set({
          balance: updatedBalance,
          lastSyncedAt: new Date().toISOString(),
        })
        .where(eq(cryptoAssetTable.id, id))
        .returning();

      return {
        asset: updated,
        currentPrice,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );

export default cryptoRoutes;
