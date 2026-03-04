import { cors } from "@elysiajs/cors";
import { yoga } from "@elysiajs/graphql-yoga";
import { useParserCache } from "@envelop/parser-cache";
import { useValidationCache } from "@envelop/validation-cache";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { schema } from "generated/graphql/schema.executable";
import { useGrafast } from "grafast/envelop";

import appConfig from "lib/config/app.config";
import {
  CORS_ALLOWED_ORIGINS,
  isDevEnv,
  isProdEnv,
  PORT,
} from "lib/config/env.config";
import { dbPool, pgPool } from "lib/db/db";
import createGraphqlContext from "lib/graphql/createGraphqlContext";
import { armorPlugin, authenticationPlugin } from "lib/graphql/plugins";
import {
  generateBalanceSheet,
  generateProfitAndLoss,
  generateTrialBalance,
} from "lib/reports";

/**
 * Elysia server.
 */
const app = new Elysia()
  .onAfterHandle(({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "1; mode=block";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  })
  .use(
    cors({
      origin: CORS_ALLOWED_ORIGINS?.split(",") ?? [],
      methods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
    service: appConfig.name,
  }))
  .get("/ready", async ({ set }) => {
    try {
      await dbPool.execute(sql`SELECT 1`);

      return {
        status: "ready",
        database: "connected",
        timestamp: Date.now(),
      };
    } catch {
      set.status = 503;
      return {
        status: "not ready",
        database: "disconnected",
        timestamp: Date.now(),
      };
    }
  })
  // Report REST endpoints
  .get("/api/reports/profit-and-loss", async ({ query }) => {
    const { bookId, startDate, endDate } = query;
    if (!bookId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "bookId, startDate, and endDate are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateProfitAndLoss({ bookId, startDate, endDate });
  })
  .get("/api/reports/balance-sheet", async ({ query }) => {
    const { bookId, asOfDate } = query;
    if (!bookId || !asOfDate) {
      return new Response(
        JSON.stringify({ error: "bookId and asOfDate are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateBalanceSheet({ bookId, asOfDate });
  })
  .get("/api/reports/trial-balance", async ({ query }) => {
    const { bookId, startDate, endDate } = query;
    if (!bookId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "bookId, startDate, and endDate are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateTrialBalance({ bookId, startDate, endDate });
  });

app.use(
  yoga({
    schema,
    context: createGraphqlContext,
    graphiql: isDevEnv,
    plugins: [
      ...armorPlugin,
      authenticationPlugin,
      isProdEnv && useDisableIntrospection(),
      useParserCache(),
      useValidationCache(),
      useGrafast(),
    ],
  }),
);

app.listen(PORT);

console.info(
  `🦊 ${appConfig.name} Elysia server running at ${app.server?.url.toString().slice(0, -1)}`,
);
console.info(
  `🧘 ${appConfig.name} GraphQL Yoga API running at ${app.server?.url}graphql`,
);

/**
 * Graceful shutdown handler.
 */
const shutdown = async (signal: string) => {
  console.info(`[Server] Received ${signal}, shutting down gracefully...`);
  app.stop();
  await pgPool.end();
  console.info("[Server] Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
