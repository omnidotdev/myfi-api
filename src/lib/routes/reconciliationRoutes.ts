import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { reconciliationQueueTable } from "lib/db/schema";

// Reconciliation queue routes
const reconciliationRoutes = new Elysia({ prefix: "/api/reconciliation" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const items = await dbPool
      .select()
      .from(reconciliationQueueTable)
      .where(eq(reconciliationQueueTable.bookId, bookId));

    return { items };
  })
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: reconciliationQueueTable.id })
        .from(reconciliationQueueTable)
        .where(eq(reconciliationQueueTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Reconciliation item not found" };
      }

      const [item] = await dbPool
        .update(reconciliationQueueTable)
        .set({
          status: body.status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: body.reviewedBy ?? null,
        })
        .where(eq(reconciliationQueueTable.id, id))
        .returning();

      return { item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([
          t.Literal("approved"),
          t.Literal("adjusted"),
          t.Literal("rejected"),
        ]),
        reviewedBy: t.Optional(t.String()),
      }),
    },
  );

export default reconciliationRoutes;
