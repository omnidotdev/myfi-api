import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { timeEntryTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { billTimeEntries } from "./billTimeEntries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Time tracking: log billable time and group unbilled entries onto a draft
 * invoice. Book-scoped (viewer reads, editor writes) by the global
 * bookAccessMiddleware via bookId in the query or body; id-addressed routes
 * resolve the owning book themselves
 */
const timeEntryRoutes = new Elysia({ prefix: "/api/time-entries" })
  .get("/", async ({ query, set }) => {
    const { bookId, customerId, unbilledOnly } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const clauses = [eq(timeEntryTable.bookId, bookId)];
    if (customerId) clauses.push(eq(timeEntryTable.customerId, customerId));
    if (unbilledOnly === "true") clauses.push(isNull(timeEntryTable.invoiceId));
    const entries = await dbPool
      .select()
      .from(timeEntryTable)
      .where(and(...clauses))
      .orderBy(desc(timeEntryTable.date));
    return { entries };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      const [entry] = await dbPool
        .insert(timeEntryTable)
        .values({
          bookId: body.bookId,
          customerId: body.customerId ?? null,
          serviceItemId: body.serviceItemId ?? null,
          date: body.date,
          hours: (body.hours ?? 0).toFixed(4),
          rate: (body.rate ?? 0).toFixed(4),
          description: body.description ?? null,
          billable: body.billable ?? true,
        })
        .returning();
      set.status = 201;
      return { entry };
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.Optional(t.String()),
        serviceItemId: t.Optional(t.String()),
        date: t.String(),
        hours: t.Optional(t.Number()),
        rate: t.Optional(t.Number()),
        description: t.Optional(t.String()),
        billable: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(timeEntryTable)
        .where(eq(timeEntryTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Time entry not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };
      if (existing.invoiceId) {
        set.status = 400;
        return { error: "A billed time entry cannot be edited" };
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.date !== undefined) updates.date = body.date;
      if (body.hours !== undefined) updates.hours = body.hours.toFixed(4);
      if (body.rate !== undefined) updates.rate = body.rate.toFixed(4);
      if (body.description !== undefined)
        updates.description = body.description;
      if (body.billable !== undefined) updates.billable = body.billable;
      if (body.customerId !== undefined) updates.customerId = body.customerId;

      const [entry] = await dbPool
        .update(timeEntryTable)
        .set(updates)
        .where(eq(timeEntryTable.id, params.id))
        .returning();
      return { entry };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        date: t.Optional(t.String()),
        hours: t.Optional(t.Number()),
        rate: t.Optional(t.Number()),
        description: t.Optional(t.String()),
        billable: t.Optional(t.Boolean()),
        customerId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(timeEntryTable)
        .where(eq(timeEntryTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Time entry not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(timeEntryTable)
        .where(eq(timeEntryTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Bill selected unbilled entries onto a new draft invoice
  .post(
    "/bill",
    async ({ body, set }) => {
      if (!ISO_DATE.test(body.issueDate) || !ISO_DATE.test(body.dueDate)) {
        set.status = 400;
        return { error: "issueDate and dueDate must be YYYY-MM-DD dates" };
      }
      try {
        return await billTimeEntries({
          bookId: body.bookId,
          customerId: body.customerId,
          entryIds: body.entryIds,
          number: body.number,
          issueDate: body.issueDate,
          dueDate: body.dueDate,
          incomeAccountId: body.incomeAccountId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Billing failed";
        if (/at least one|not available to bill/i.test(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[time-entries] bill failed:", err);
        set.status = 500;
        return { error: "Could not bill the time entries" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.String(),
        entryIds: t.Array(t.String()),
        number: t.String(),
        issueDate: t.String(),
        dueDate: t.String(),
        incomeAccountId: t.String(),
      }),
    },
  );

export default timeEntryRoutes;
