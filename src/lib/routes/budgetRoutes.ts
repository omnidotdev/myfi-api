import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { budgetTable } from "lib/db/schema";

// Budget CRUD routes
const budgetRoutes = new Elysia({ prefix: "/api/budgets" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const budgets = await dbPool
      .select()
      .from(budgetTable)
      .where(eq(budgetTable.bookId, bookId));

    return { budgets };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [budget] = await dbPool
        .insert(budgetTable)
        .values({
          bookId: body.bookId,
          accountId: body.accountId,
          amount: body.amount,
          period: body.period ?? "monthly",
          rollover: body.rollover ?? false,
        })
        .returning();

      set.status = 201;

      return { budget };
    },
    {
      body: t.Object({
        bookId: t.String(),
        accountId: t.String(),
        amount: t.String(),
        period: t.Optional(
          t.Union([
            t.Literal("monthly"),
            t.Literal("quarterly"),
            t.Literal("yearly"),
          ]),
        ),
        rollover: t.Optional(t.Boolean()),
      }),
    },
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: budgetTable.id })
        .from(budgetTable)
        .where(eq(budgetTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Budget not found" };
      }

      const [budget] = await dbPool
        .update(budgetTable)
        .set({
          accountId: body.accountId,
          amount: body.amount,
          period: body.period,
          rollover: body.rollover,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(budgetTable.id, id))
        .returning();

      return { budget };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        accountId: t.Optional(t.String()),
        amount: t.Optional(t.String()),
        period: t.Optional(
          t.Union([
            t.Literal("monthly"),
            t.Literal("quarterly"),
            t.Literal("yearly"),
          ]),
        ),
        rollover: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: budgetTable.id })
        .from(budgetTable)
        .where(eq(budgetTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Budget not found" };
      }

      await dbPool.delete(budgetTable).where(eq(budgetTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default budgetRoutes;
