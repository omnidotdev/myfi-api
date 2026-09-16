import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { recurringTransactionTable } from "lib/db/schema";
import { materializeRecurring } from "./materializeRecurring";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];

/**
 * Recurring (memorized) transaction routes. A recurring transaction is a
 * template that posts a balanced entry (debit account, credit counter account)
 * on a schedule. CRUD plus a manual run; a scheduler also posts due ones daily.
 * Book access is enforced by the global bookAccessMiddleware
 */
const recurringRoutes = new Elysia({ prefix: "/api/recurring-transactions" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const items = await dbPool
      .select()
      .from(recurringTransactionTable)
      .where(eq(recurringTransactionTable.bookId, bookId))
      .orderBy(desc(recurringTransactionTable.nextExpectedDate));
    return { recurringTransactions: items };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!FREQUENCIES.includes(body.frequency)) {
        set.status = 400;
        return { error: "Invalid frequency" };
      }
      if (!ISO_DATE.test(body.nextExpectedDate)) {
        set.status = 400;
        return { error: "nextExpectedDate must be a YYYY-MM-DD date" };
      }
      const [created] = await dbPool
        .insert(recurringTransactionTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          amount: body.amount,
          frequency: body.frequency as never,
          accountId: body.accountId,
          counterAccountId: body.counterAccountId ?? null,
          nextExpectedDate: `${body.nextExpectedDate}T00:00:00.000Z`,
        })
        .returning();
      set.status = 201;
      emitAudit({
        type: "myfi.recurring_transaction.created",
        organizationId: body.bookId,
        resource: {
          type: "recurring_transaction",
          id: created.id,
          name: created.name,
        },
        data: { bookId: body.bookId, frequency: body.frequency },
      });
      return { recurringTransaction: created };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        amount: t.String(),
        frequency: t.String(),
        accountId: t.String(),
        counterAccountId: t.Optional(t.String()),
        nextExpectedDate: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(recurringTransactionTable)
        .where(eq(recurringTransactionTable.id, params.id));
      if (!existing || existing.bookId !== body.bookId) {
        set.status = 404;
        return { error: "Recurring transaction not found" };
      }
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.amount !== undefined) updates.amount = body.amount;
      if (body.frequency !== undefined) {
        if (!FREQUENCIES.includes(body.frequency)) {
          set.status = 400;
          return { error: "Invalid frequency" };
        }
        updates.frequency = body.frequency;
      }
      if (body.counterAccountId !== undefined)
        updates.counterAccountId = body.counterAccountId;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.nextExpectedDate !== undefined) {
        if (!ISO_DATE.test(body.nextExpectedDate)) {
          set.status = 400;
          return { error: "nextExpectedDate must be a YYYY-MM-DD date" };
        }
        updates.nextExpectedDate = `${body.nextExpectedDate}T00:00:00.000Z`;
      }
      const [updated] = await dbPool
        .update(recurringTransactionTable)
        .set(updates)
        .where(eq(recurringTransactionTable.id, params.id))
        .returning();
      return { recurringTransaction: updated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        name: t.Optional(t.String()),
        amount: t.Optional(t.String()),
        frequency: t.Optional(t.String()),
        counterAccountId: t.Optional(t.Nullable(t.String())),
        isActive: t.Optional(t.Boolean()),
        nextExpectedDate: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(recurringTransactionTable)
        .where(eq(recurringTransactionTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Recurring transaction not found" };
      }
      await dbPool
        .delete(recurringTransactionTable)
        .where(eq(recurringTransactionTable.id, params.id));
      emitAudit({
        type: "myfi.recurring_transaction.deleted",
        organizationId: existing.bookId,
        resource: {
          type: "recurring_transaction",
          id: existing.id,
          name: existing.name,
        },
      });
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Post any due occurrences now (through today, or a given asOf date)
  .post(
    "/:id/run",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(recurringTransactionTable)
        .where(eq(recurringTransactionTable.id, params.id));
      if (!existing || existing.bookId !== body.bookId) {
        set.status = 404;
        return { error: "Recurring transaction not found" };
      }
      const asOf =
        body.asOf && ISO_DATE.test(body.asOf)
          ? body.asOf
          : new Date().toISOString().slice(0, 10);
      const result = await materializeRecurring(existing, asOf);
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String(), asOf: t.Optional(t.String()) }),
    },
  );

export default recurringRoutes;
