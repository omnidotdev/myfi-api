import { Elysia, t } from "elysia";

import {
  acquireLot,
  disposeLot,
  getUnrealizedGains,
  listLots,
} from "./costBasis";

// REST routes for crypto lot operations (cost-basis tracking)
const lotRoutes = new Elysia({ prefix: "/api/crypto/lots" })
  .post(
    "/acquire",
    async ({ body, set }) => {
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
    async ({ body, set }) => {
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
    async ({ query, set }) => {
      const { cryptoAssetId, currentPriceUsd } = query;

      if (!cryptoAssetId || !currentPriceUsd) {
        set.status = 400;

        return {
          error:
            "cryptoAssetId and currentPriceUsd query parameters are required",
        };
      }

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
    async ({ query, set }) => {
      const { cryptoAssetId } = query;

      if (!cryptoAssetId) {
        set.status = 400;

        return { error: "cryptoAssetId query parameter is required" };
      }

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
