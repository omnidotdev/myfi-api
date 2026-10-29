import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { priceLevelTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

/**
 * Price level CRUD. Book-scoped (viewer reads, editor writes) by the global
 * bookAccessMiddleware via bookId in the query or body; id-addressed routes
 * resolve the owning book themselves
 */
const priceLevelRoutes = new Elysia({ prefix: "/api/price-levels" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const priceLevels = await dbPool
      .select()
      .from(priceLevelTable)
      .where(eq(priceLevelTable.bookId, bookId));
    return { priceLevels };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [priceLevel] = await dbPool
        .insert(priceLevelTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          adjustmentPercent: body.adjustmentPercent.toFixed(4),
        })
        .returning();
      set.status = 201;
      return { priceLevel };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        adjustmentPercent: t.Number(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(priceLevelTable)
        .where(eq(priceLevelTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Price level not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.adjustmentPercent !== undefined)
        updates.adjustmentPercent = body.adjustmentPercent.toFixed(4);
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      const [priceLevel] = await dbPool
        .update(priceLevelTable)
        .set(updates)
        .where(eq(priceLevelTable.id, params.id))
        .returning();
      return { priceLevel };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        adjustmentPercent: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(priceLevelTable)
        .where(eq(priceLevelTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Price level not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(priceLevelTable)
        .where(eq(priceLevelTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export default priceLevelRoutes;
