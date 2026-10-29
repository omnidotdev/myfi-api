import { and, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import {
  bundleComponentTable,
  inventoryItemTable,
  itemBundleTable,
} from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { createBundle } from "./createBundle";

/**
 * Item bundles and their components. Book-scoped (viewer reads, editor writes)
 * by the global bookAccessMiddleware via bookId in the query or body;
 * id-addressed routes resolve the owning book themselves
 */
const bundleRoutes = new Elysia({ prefix: "/api/bundles" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const bundles = await dbPool
      .select()
      .from(itemBundleTable)
      .where(eq(itemBundleTable.bookId, bookId));
    if (bundles.length === 0) return { bundles: [] };

    const components = await dbPool
      .select({
        bundleId: bundleComponentTable.bundleId,
        inventoryItemId: bundleComponentTable.inventoryItemId,
        quantity: bundleComponentTable.quantity,
        itemName: inventoryItemTable.name,
        salePrice: inventoryItemTable.salePrice,
        incomeAccountId: inventoryItemTable.incomeAccountId,
      })
      .from(bundleComponentTable)
      .innerJoin(
        inventoryItemTable,
        eq(bundleComponentTable.inventoryItemId, inventoryItemTable.id),
      )
      .where(
        inArray(
          bundleComponentTable.bundleId,
          bundles.map((b) => b.id),
        ),
      );

    return {
      bundles: bundles.map((b) => ({
        ...b,
        components: components.filter((c) => c.bundleId === b.id),
      })),
    };
  })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createBundle({
          bookId: body.bookId,
          name: body.name,
          description: body.description,
          components: body.components,
        });
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (
          /at least one component|do not belong to this book/i.test(message)
        ) {
          set.status = 400;
          return { error: message };
        }
        console.error("[bundles] create failed:", err);
        set.status = 500;
        return { error: "Could not create the bundle" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        components: t.Array(
          t.Object({
            inventoryItemId: t.String(),
            quantity: t.Number(),
          }),
        ),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(itemBundleTable)
        .where(eq(itemBundleTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Bundle not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(itemBundleTable)
        .where(and(eq(itemBundleTable.id, params.id)));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export default bundleRoutes;
