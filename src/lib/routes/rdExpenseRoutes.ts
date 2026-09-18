import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { rdExpenseTable } from "lib/db/schema";

const CATEGORIES = [
  "wages",
  "supplies",
  "contract_research",
  "cloud_computing",
  "other",
];

// Captured qualified research expense (QRE) CRUD, feeding the R&D credit worksheet
const rdExpenseRoutes = new Elysia({ prefix: "/api/rd-expenses" })
  .get("/", async ({ query, set }) => {
    const { bookId, year } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const whereClause = year
      ? and(
          eq(rdExpenseTable.bookId, bookId),
          eq(rdExpenseTable.year, Number.parseInt(year, 10)),
        )
      : eq(rdExpenseTable.bookId, bookId);

    const expenses = await dbPool
      .select()
      .from(rdExpenseTable)
      .where(whereClause)
      .orderBy(desc(rdExpenseTable.year), desc(rdExpenseTable.createdAt));

    return { expenses };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!CATEGORIES.includes(body.category)) {
        set.status = 400;
        return { error: "Unknown category" };
      }

      const [expense] = await dbPool
        .insert(rdExpenseTable)
        .values({
          bookId: body.bookId,
          year: body.year,
          category: body.category,
          description: body.description,
          amount: body.amount,
          isForeign: body.isForeign ?? false,
          projectId: body.projectId ?? null,
          notes: body.notes ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.rd_expense.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "rd_expense",
          id: expense.id,
          name: expense.description,
        },
        data: { bookId: body.bookId, year: expense.year },
      });

      return { expense };
    },
    {
      body: t.Object({
        bookId: t.String(),
        year: t.Number(),
        category: t.String(),
        description: t.String(),
        amount: t.String(),
        isForeign: t.Optional(t.Boolean()),
        projectId: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(rdExpenseTable)
        .where(eq(rdExpenseTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Expense not found" };
      }

      if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
        set.status = 400;
        return { error: "Unknown category" };
      }

      const updates: Record<string, unknown> = {};
      if (body.year !== undefined) updates.year = body.year;
      if (body.category !== undefined) updates.category = body.category;
      if (body.description !== undefined)
        updates.description = body.description;
      if (body.amount !== undefined) updates.amount = body.amount;
      if (body.isForeign !== undefined) updates.isForeign = body.isForeign;
      if (body.projectId !== undefined) updates.projectId = body.projectId;
      if (body.notes !== undefined) updates.notes = body.notes;

      const [expense] = await dbPool
        .update(rdExpenseTable)
        .set(updates)
        .where(eq(rdExpenseTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.rd_expense.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "rd_expense",
          id: expense.id,
          name: expense.description,
        },
        data: { bookId: existing.bookId },
      });

      return { expense };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        year: t.Optional(t.Number()),
        category: t.Optional(t.String()),
        description: t.Optional(t.String()),
        amount: t.Optional(t.String()),
        isForeign: t.Optional(t.Boolean()),
        projectId: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(rdExpenseTable)
        .where(eq(rdExpenseTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Expense not found" };
      }

      await dbPool
        .delete(rdExpenseTable)
        .where(eq(rdExpenseTable.id, params.id));

      emitAudit({
        type: "myfi.rd_expense.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "rd_expense",
          id: existing.id,
          name: existing.description,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default rdExpenseRoutes;
