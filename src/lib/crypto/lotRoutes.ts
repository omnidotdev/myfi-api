import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import {
  acquireLot,
  disposeLot,
  getUnrealizedGains,
  listLots,
} from "./costBasis";

// Resolve the book that owns a crypto asset so lot routes (keyed on
// cryptoAssetId, not a bookId) can be authorized against the asset's own book
const resolveAssetBookId = async (
  cryptoAssetId: string,
): Promise<string | null> => {
  const [asset] = await dbPool
    .select({ bookId: cryptoAssetTable.bookId })
    .from(cryptoAssetTable)
    .where(eq(cryptoAssetTable.id, cryptoAssetId));

  return asset?.bookId ?? null;
};

// REST routes for crypto lot operations (cost-basis tracking)
const lotRoutes = new Elysia({ prefix: "/api/crypto/lots" })
  .post(
    "/acquire",
    async ({ body, set, request }) => {
      // Keyed on cryptoAssetId, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the asset's own book
      const bookId = await resolveAssetBookId(body.cryptoAssetId);
      if (!bookId) {
        set.status = 404;
        return { error: "Crypto asset not found" };
      }
      const auth = await authorizeBook(request, bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      try {
        const lot = await acquireLot(body);

        set.status = 201;

        return { lot };
      } catch (err) {
        set.status = 400;

        return {
          error: "Failed to acquire lot",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      body: t.Object({
        cryptoAssetId: t.String(),
        quantity: t.String(),
        costPerUnit: t.String(),
        acquiredAt: t.String(),
        journalEntryId: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/dispose",
    async ({ body, set, request }) => {
      // Keyed on cryptoAssetId, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the asset's own book
      const bookId = await resolveAssetBookId(body.cryptoAssetId);
      if (!bookId) {
        set.status = 404;
        return { error: "Crypto asset not found" };
      }
      const auth = await authorizeBook(request, bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      try {
        const result = await disposeLot(body);

        return result;
      } catch (err) {
        set.status = 400;

        return {
          error: "Failed to dispose lots",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      body: t.Object({
        cryptoAssetId: t.String(),
        quantity: t.String(),
        proceedsPerUnit: t.String(),
        disposedAt: t.String(),
        journalEntryId: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/unrealized",
    async ({ query, set, request }) => {
      const { cryptoAssetId, currentPriceUsd } = query;

      if (!cryptoAssetId || !currentPriceUsd) {
        set.status = 400;

        return {
          error:
            "cryptoAssetId and currentPriceUsd query parameters are required",
        };
      }

      // Keyed on cryptoAssetId, not a `bookId` field, so the global middleware
      // does not guard it: require viewer on the asset's own book
      const bookId = await resolveAssetBookId(cryptoAssetId);
      if (!bookId) {
        set.status = 404;
        return { error: "Crypto asset not found" };
      }
      const auth = await authorizeBook(request, bookId, "viewer", set);
      if (!auth) return { error: "Forbidden" };

      const price = Number(currentPriceUsd);

      if (Number.isNaN(price) || price < 0) {
        set.status = 400;

        return { error: "currentPriceUsd must be a valid non-negative number" };
      }

      try {
        const result = await getUnrealizedGains(cryptoAssetId, price);

        return result;
      } catch (err) {
        set.status = 400;

        return {
          error: "Failed to calculate unrealized gains",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      query: t.Object({
        cryptoAssetId: t.String(),
        currentPriceUsd: t.String(),
      }),
    },
  )
  .get(
    "/",
    async ({ query, set, request }) => {
      const { cryptoAssetId } = query;

      if (!cryptoAssetId) {
        set.status = 400;

        return { error: "cryptoAssetId query parameter is required" };
      }

      // Keyed on cryptoAssetId, not a `bookId` field, so the global middleware
      // does not guard it: require viewer on the asset's own book
      const bookId = await resolveAssetBookId(cryptoAssetId);
      if (!bookId) {
        set.status = 404;
        return { error: "Crypto asset not found" };
      }
      const auth = await authorizeBook(request, bookId, "viewer", set);
      if (!auth) return { error: "Forbidden" };

      try {
        const lots = await listLots(cryptoAssetId);

        return { lots };
      } catch (err) {
        set.status = 400;

        return {
          error: "Failed to list lots",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    },
    {
      query: t.Object({
        cryptoAssetId: t.String(),
      }),
    },
  );

export default lotRoutes;
