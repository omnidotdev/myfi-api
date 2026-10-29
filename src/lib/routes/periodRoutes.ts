import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { revalueForeignBalances } from "lib/accounting/revalueForeignBalances";
import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { accountingPeriodTable, reconciliationQueueTable } from "lib/db/schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Period management routes
const periodRoutes = new Elysia({ prefix: "/api/periods" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const periods = await dbPool
      .select()
      .from(accountingPeriodTable)
      .where(eq(accountingPeriodTable.bookId, bookId));

    return { periods };
  })
  .post(
    "/close",
    async ({ body, set }) => {
      const { bookId, year, month } = body;

      // Check for pending review items in the reconciliation queue
      const pendingItems = await dbPool
        .select({ id: reconciliationQueueTable.id })
        .from(reconciliationQueueTable)
        .where(
          and(
            eq(reconciliationQueueTable.bookId, bookId),
            eq(reconciliationQueueTable.periodYear, year),
            eq(reconciliationQueueTable.periodMonth, month),
            eq(reconciliationQueueTable.status, "pending_review"),
          ),
        );

      if (pendingItems.length > 0) {
        set.status = 409;
        return {
          error: "Cannot close period with pending review items",
          blockers: { pendingReviewCount: pendingItems.length },
        };
      }

      // Check if the period already exists
      const [existing] = await dbPool
        .select()
        .from(accountingPeriodTable)
        .where(
          and(
            eq(accountingPeriodTable.bookId, bookId),
            eq(accountingPeriodTable.year, year),
            eq(accountingPeriodTable.month, month),
          ),
        );

      const now = new Date().toISOString();
      const closedBy = body.closedBy ?? "manual";

      const [period] = existing
        ? await dbPool
            .update(accountingPeriodTable)
            .set({
              status: "closed",
              closedAt: now,
              closedBy,
              blockers: null,
            })
            .where(eq(accountingPeriodTable.id, existing.id))
            .returning()
        : await dbPool
            .insert(accountingPeriodTable)
            .values({
              bookId,
              year,
              month,
              status: "closed",
              closedAt: now,
              closedBy,
              blockers: null,
            })
            .returning();

      emitAudit({
        type: "myfi.period.closed",
        organizationId: body.bookId,
        actor: { id: body.closedBy ?? "unknown" },
        resource: { type: "accounting_period", id: period.id },
        data: {
          year: body.year,
          month: body.month,
          closedBy: body.closedBy ?? "manual",
        },
      });

      return { period };
    },
    {
      body: t.Object({
        bookId: t.String(),
        year: t.Number(),
        month: t.Number(),
        closedBy: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/reopen",
    async ({ body, set }) => {
      const { bookId, year, month } = body;

      const [existing] = await dbPool
        .select()
        .from(accountingPeriodTable)
        .where(
          and(
            eq(accountingPeriodTable.bookId, bookId),
            eq(accountingPeriodTable.year, year),
            eq(accountingPeriodTable.month, month),
          ),
        );

      if (!existing) {
        set.status = 404;
        return { error: "Period not found" };
      }

      if (existing.status !== "closed") {
        set.status = 409;
        return { error: "Period is not closed" };
      }

      const [period] = await dbPool
        .update(accountingPeriodTable)
        .set({
          status: "open",
          reopenedAt: new Date().toISOString(),
        })
        .where(eq(accountingPeriodTable.id, existing.id))
        .returning();

      emitAudit({
        type: "myfi.period.reopened",
        organizationId: body.bookId,
        resource: { type: "accounting_period", id: period.id },
        data: { year: body.year, month: body.month },
      });

      return { period };
    },
    {
      body: t.Object({
        bookId: t.String(),
        year: t.Number(),
        month: t.Number(),
      }),
    },
  )
  // Period-end unrealized FX revaluation (Home Currency Adjustment): revalue
  // open foreign receivables/payables to the supplied current rates and post
  // the unrealized gain/loss, auto-reversed the next day
  .post(
    "/revalue-fx",
    async ({ body, set }) => {
      if (!ISO_DATE.test(body.asOfDate)) {
        set.status = 400;
        return { error: "asOfDate must be a YYYY-MM-DD date" };
      }
      try {
        const result = await revalueForeignBalances({
          bookId: body.bookId,
          asOfDate: body.asOfDate,
          rates: body.rates,
          reverseDate: body.reverseDate,
        });
        emitAudit({
          type: "myfi.period.fx_revalued",
          organizationId: body.bookId,
          resource: { type: "book", id: body.bookId },
          data: { asOfDate: body.asOfDate, netGainLoss: result.netGainLoss },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Revaluation failed";
        if (/not found|account exists/i.test(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[periods] fx revaluation failed:", err);
        set.status = 500;
        return { error: "Could not revalue foreign balances" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        asOfDate: t.String(),
        rates: t.Record(t.String(), t.Number({ exclusiveMinimum: 0 })),
        reverseDate: t.Optional(t.String()),
      }),
    },
  );

export default periodRoutes;
