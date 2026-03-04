import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { savingsGoalTable } from "lib/db/schema";

// Savings goal CRUD routes
const savingsRoutes = new Elysia({ prefix: "/api/savings-goals" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const goals = await dbPool
      .select()
      .from(savingsGoalTable)
      .where(eq(savingsGoalTable.bookId, bookId));

    return { goals };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [goal] = await dbPool
        .insert(savingsGoalTable)
        .values({
          bookId: body.bookId,
          accountId: body.accountId,
          name: body.name,
          targetAmount: body.targetAmount,
          targetDate: body.targetDate ?? null,
        })
        .returning();

      set.status = 201;

      return { goal };
    },
    {
      body: t.Object({
        bookId: t.String(),
        accountId: t.String(),
        name: t.String(),
        targetAmount: t.String(),
        targetDate: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: savingsGoalTable.id })
        .from(savingsGoalTable)
        .where(eq(savingsGoalTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Savings goal not found" };
      }

      await dbPool.delete(savingsGoalTable).where(eq(savingsGoalTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default savingsRoutes;
