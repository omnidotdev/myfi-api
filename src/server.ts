import { cors } from "@elysiajs/cors";
import { yoga } from "@elysiajs/graphql-yoga";
import { useParserCache } from "@envelop/parser-cache";
import { useValidationCache } from "@envelop/validation-cache";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import { desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { schema } from "generated/graphql/schema.executable";
import { useGrafast } from "grafast/envelop";

import generateBudgetTracking from "lib/budgets/budgetTracking";
import { runMonthlyClose } from "lib/close";
import startScheduledClose from "lib/close/scheduledClose";
import runYearEndClose from "lib/close/yearEndClose";
import appConfig from "lib/config/app.config";
import {
  CORS_ALLOWED_ORIGINS,
  PORT,
  isDevEnv,
  isProdEnv,
} from "lib/config/env.config";
import { cryptoRoutes, lotRoutes } from "lib/crypto";
import { dbPool, pgPool } from "lib/db/db";
import { netWorthSnapshotTable } from "lib/db/schema";
import createGraphqlContext from "lib/graphql/createGraphqlContext";
import { armorPlugin, authenticationPlugin } from "lib/graphql/plugins";
import importRoutes from "lib/import/importRoutes";
import profileRoutes from "lib/import/profileRoutes";
import { mantleWebhook } from "lib/mantle";
import authMiddleware from "lib/middleware/auth.middleware";
import bookAccessMiddleware from "lib/middleware/bookAccess.middleware";
import {
  computeNetWorth,
  saveNetWorthSnapshot,
} from "lib/netWorth/netWorthService";
import ofxRoutes from "lib/ofx/ofxRoutes";
import { payrollCallbackRoute, payrollRoutes } from "lib/payroll";
import plaidRoutes from "lib/plaid/plaidRoutes";
import startScheduledSync from "lib/plaid/scheduledSync";
import {
  exportReport,
  generateAgingReport,
  generateBalanceSheet,
  generateCashFlow,
  generateGeneralLedger,
  generatePayrollSummary,
  generateProfitAndLoss,
  generateSalesTaxReport,
  generateTrialBalance,
} from "lib/reports";
import accountRoutes from "lib/routes/accountRoutes";
import bookAccessRoutes from "lib/routes/bookAccessRoutes";
import bookRoutes from "lib/routes/bookRoutes";
import budgetRoutes from "lib/routes/budgetRoutes";
import categorizationRuleRoutes from "lib/routes/categorizationRuleRoutes";
import connectionRoutes from "lib/routes/connectionRoutes";
import dashboardRoutes from "lib/routes/dashboardRoutes";
import fixedAssetRoutes from "lib/routes/fixedAssetRoutes";
import journalRoutes from "lib/routes/journalRoutes";
import mappingRoutes from "lib/routes/mappingRoutes";
import mileageRoutes from "lib/routes/mileageRoutes";
import periodRoutes from "lib/routes/periodRoutes";
import reconciliationRoutes from "lib/routes/reconciliationRoutes";
import savingsRoutes from "lib/routes/savingsRoutes";
import statementReconciliationRoutes from "lib/routes/statementReconciliationRoutes";
import tagRoutes from "lib/routes/tagRoutes";
import taxJurisdictionRoutes from "lib/routes/taxJurisdictionRoutes";
import vendorRoutes from "lib/routes/vendorRoutes";
import {
  detectRecurringTransactions,
  getSpendingByCategory,
  getSpendingTrends,
} from "lib/spending";
import {
  generate1099Nec,
  generateForm8949,
  generateQuarterlyEstimates,
  generateScheduleC,
  generateTaxLossHarvesting,
} from "lib/tax";

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
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
  // Public (no auth)
  .use(mantleWebhook)
  .use(payrollCallbackRoute)
  // GraphQL (has its own @envelop/generic-auth plugin)
  .use(
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
  )
  // Auth boundary
  .use(authMiddleware)
  // Book access authorization (checks book_access table for role-based permissions)
  .use(bookAccessMiddleware)
  // Protected routes
  .use(plaidRoutes)
  .use(cryptoRoutes)
  .use(lotRoutes)
  .use(bookRoutes)
  .use(bookAccessRoutes)
  .use(accountRoutes)
  .use(journalRoutes)
  .use(budgetRoutes)
  .use(savingsRoutes)
  .use(reconciliationRoutes)
  .use(statementReconciliationRoutes)
  .use(connectionRoutes)
  .use(mappingRoutes)
  .use(mileageRoutes)
  .use(categorizationRuleRoutes)
  .use(dashboardRoutes)
  .use(fixedAssetRoutes)
  .use(importRoutes)
  .use(profileRoutes)
  .use(ofxRoutes)
  .use(periodRoutes)
  .use(tagRoutes)
  .use(taxJurisdictionRoutes)
  .use(vendorRoutes)
  .use(payrollRoutes)
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
    const tagIds = query.tagIds
      ? query.tagIds.split(",").filter(Boolean)
      : undefined;
    return generateProfitAndLoss({ bookId, startDate, endDate, tagIds });
  })
  .get("/api/reports/balance-sheet", async ({ query }) => {
    const { bookId, asOfDate } = query;
    if (!bookId || !asOfDate) {
      return new Response(
        JSON.stringify({ error: "bookId and asOfDate are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const tagIds = query.tagIds
      ? query.tagIds.split(",").filter(Boolean)
      : undefined;
    return generateBalanceSheet({ bookId, asOfDate, tagIds });
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
    const tagIds = query.tagIds
      ? query.tagIds.split(",").filter(Boolean)
      : undefined;
    return generateTrialBalance({ bookId, startDate, endDate, tagIds });
  })
  .get("/api/reports/cash-flow", async ({ query }) => {
    const { bookId, startDate, endDate } = query;
    if (!bookId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "bookId, startDate, and endDate are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const tagIds = query.tagIds
      ? query.tagIds.split(",").filter(Boolean)
      : undefined;
    return generateCashFlow({ bookId, startDate, endDate, tagIds });
  })
  .get("/api/reports/general-ledger", async ({ query }) => {
    const { bookId, accountId, startDate, endDate } = query;
    if (!bookId || !accountId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "bookId, accountId, startDate, and endDate are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const tagIds = query.tagIds
      ? query.tagIds.split(",").filter(Boolean)
      : undefined;
    return generateGeneralLedger({
      bookId,
      accountId,
      startDate,
      endDate,
      tagIds,
    });
  })
  .get("/api/reports/sales-tax", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateSalesTaxReport({
      bookId,
      year: Number.parseInt(year, 10),
      jurisdictionId: query.jurisdictionId || undefined,
    });
  })
  .get("/api/reports/payroll", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generatePayrollSummary({
      bookId,
      year: Number.parseInt(year, 10),
    });
  })
  .get("/api/reports/ap-aging", async ({ query }) => {
    const { bookId, asOfDate } = query;
    if (!bookId || !asOfDate) {
      return new Response(
        JSON.stringify({
          error: "bookId and asOfDate are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return generateAgingReport({
      bookId,
      asOfDate,
      accountSubType: "accounts_payable",
    });
  })
  .get("/api/reports/ar-aging", async ({ query }) => {
    const { bookId, asOfDate } = query;
    if (!bookId || !asOfDate) {
      return new Response(
        JSON.stringify({
          error: "bookId and asOfDate are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return generateAgingReport({
      bookId,
      asOfDate,
      accountSubType: "accounts_receivable",
    });
  })
  .get("/api/budgets/tracking", async ({ query }) => {
    const { bookId, period } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return generateBudgetTracking({ bookId, period });
  })
  // Spending analysis endpoints
  .get("/api/spending/categories", async ({ query }) => {
    const { bookId, startDate, endDate } = query;
    if (!bookId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          error: "bookId, startDate, and endDate are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return getSpendingByCategory({ bookId, startDate, endDate });
  })
  .get("/api/spending/trends", async ({ query }) => {
    const { bookId, months } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return getSpendingTrends({
      bookId,
      months: months ? Number.parseInt(months, 10) : 12,
    });
  })
  .get("/api/spending/recurring", async ({ query }) => {
    const { bookId } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return detectRecurringTransactions({ bookId });
  })
  // Net worth endpoints
  .get("/api/net-worth", async ({ query }) => {
    const { bookId } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return computeNetWorth({ bookId });
  })
  .post(
    "/api/net-worth/snapshot",
    async ({ body }) => {
      return saveNetWorthSnapshot({ bookId: body.bookId });
    },
    {
      body: t.Object({ bookId: t.String() }),
    },
  )
  .get("/api/net-worth/history", async ({ query }) => {
    const { bookId, limit } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const take = limit ? Number.parseInt(limit, 10) : 24;
    const snapshots = await dbPool
      .select()
      .from(netWorthSnapshotTable)
      .where(eq(netWorthSnapshotTable.bookId, bookId))
      .orderBy(desc(netWorthSnapshotTable.date))
      .limit(take);
    return { snapshots: snapshots.reverse() };
  })
  // Tax report endpoints
  .get("/api/tax/1099-nec", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generate1099Nec({ bookId, year: Number.parseInt(year, 10) });
  })
  .get("/api/tax/schedule-c", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateScheduleC({ bookId, year: Number.parseInt(year, 10) });
  })
  .get("/api/tax/form-8949", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateForm8949({ bookId, year: Number.parseInt(year, 10) });
  })
  .get("/api/tax/quarterly-estimates", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({ error: "bookId and year are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return generateQuarterlyEstimates({
      bookId,
      year: Number.parseInt(year, 10),
    });
  })
  .get("/api/tax/loss-harvesting", async ({ query }) => {
    const { bookId } = query;
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return generateTaxLossHarvesting({ bookId });
  })
  // Report export (HTML for print-to-PDF, CSV for download)
  .get("/api/reports/export", async ({ query, set }) => {
    const { type, format, bookId } = query;

    if (!type || !format || !bookId) {
      return new Response(
        JSON.stringify({
          error: "type, format, and bookId are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (format !== "html" && format !== "csv") {
      return new Response(
        JSON.stringify({ error: "format must be html or csv" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      const tagIds = query.tagIds
        ? query.tagIds.split(",").filter(Boolean)
        : undefined;

      const result = await exportReport({
        type,
        format,
        bookId,
        startDate: query.startDate,
        endDate: query.endDate,
        asOfDate: query.asOfDate,
        year: query.year,
        tagIds,
        accountId: query.accountId,
        jurisdictionId: query.jurisdictionId,
      });

      set.headers["Content-Type"] = result.contentType;
      set.headers["Content-Disposition"] =
        `attachment; filename="${result.filename}"`;

      return result.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";

      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  })
  // Job trigger endpoints
  .post("/api/jobs/monthly-close", async () => {
    const results = await runMonthlyClose();
    return { results };
  })
  .post("/api/jobs/year-end-close", async ({ query }) => {
    const { bookId, year } = query;
    if (!bookId || !year) {
      return new Response(
        JSON.stringify({
          error: "bookId and year are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const result = await runYearEndClose({
      bookId,
      year: Number.parseInt(year, 10),
    });
    return { result };
  });

app.listen(PORT);

console.info(
  `🦊 ${appConfig.name} Elysia server running at ${app.server?.url.toString().slice(0, -1)}`,
);
console.info(
  `🧘 ${appConfig.name} GraphQL Yoga API running at ${app.server?.url}graphql`,
);

const stopSync = startScheduledSync();
const stopClose = startScheduledClose();

/**
 * Graceful shutdown handler.
 */
const shutdown = async (signal: string) => {
  console.info(`[Server] Received ${signal}, shutting down gracefully...`);
  stopSync();
  stopClose();
  app.stop();
  await pgPool.end();
  console.info("[Server] Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
