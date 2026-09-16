import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { inventoryItemTable, inventoryTransactionTable } from "lib/db/schema";
import { receiveStock } from "./receiveStock";
import { recordInventorySale } from "./recordInventorySale";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isClientError = (message: string): boolean =>
  /not found|must be positive|cannot be negative|enough stock|Source account/i.test(
    message,
  );

/**
 * Inventory item CRUD plus stock movements (receive, sell). Receiving and
 * selling post to the ledger and maintain weighted-average cost. Book access is
 * enforced by the global bookAccessMiddleware; movements re-check ownership
 */
const inventoryRoutes = new Elysia({ prefix: "/api/inventory-items" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const items = await dbPool
      .select()
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.bookId, bookId));
    return { items };
  })
  .get(
    "/:id/transactions",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }
      const [item] = await dbPool
        .select()
        .from(inventoryItemTable)
        .where(eq(inventoryItemTable.id, params.id));
      if (!item || item.bookId !== bookId) {
        set.status = 404;
        return { error: "Inventory item not found" };
      }
      const transactions = await dbPool
        .select()
        .from(inventoryTransactionTable)
        .where(eq(inventoryTransactionTable.itemId, params.id))
        .orderBy(desc(inventoryTransactionTable.date));
      return { item, transactions };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      const [item] = await dbPool
        .insert(inventoryItemTable)
        .values({
          bookId: body.bookId,
          sku: body.sku ?? null,
          name: body.name,
          description: body.description ?? null,
          salePrice: (body.salePrice ?? 0).toFixed(4),
          assetAccountId: body.assetAccountId,
          cogsAccountId: body.cogsAccountId,
          incomeAccountId: body.incomeAccountId,
        })
        .returning();
      set.status = 201;
      return { item };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        sku: t.Optional(t.String()),
        description: t.Optional(t.String()),
        salePrice: t.Optional(t.Number()),
        assetAccountId: t.String(),
        cogsAccountId: t.String(),
        incomeAccountId: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(inventoryItemTable)
        .where(eq(inventoryItemTable.id, params.id));
      if (!existing || existing.bookId !== body.bookId) {
        set.status = 404;
        return { error: "Inventory item not found" };
      }
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.sku !== undefined) updates.sku = body.sku;
      if (body.description !== undefined)
        updates.description = body.description;
      if (body.salePrice !== undefined)
        updates.salePrice = body.salePrice.toFixed(4);
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      const [item] = await dbPool
        .update(inventoryItemTable)
        .set(updates)
        .where(eq(inventoryItemTable.id, params.id))
        .returning();
      return { item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        name: t.Optional(t.String()),
        sku: t.Optional(t.String()),
        description: t.Optional(t.String()),
        salePrice: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/:id/receive",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        return await receiveStock({
          itemId: params.id,
          bookId: body.bookId,
          quantity: body.quantity,
          unitCost: body.unitCost,
          date: body.date,
          sourceAccountId: body.sourceAccountId,
          note: body.note,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Receive failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[inventory] receive failed:", err);
        set.status = 500;
        return { error: "Could not receive stock" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        quantity: t.Number(),
        unitCost: t.Number(),
        date: t.String(),
        sourceAccountId: t.String(),
        note: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:id/sell",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        return await recordInventorySale({
          itemId: params.id,
          bookId: body.bookId,
          quantity: body.quantity,
          date: body.date,
          note: body.note,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sale failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[inventory] sale failed:", err);
        set.status = 500;
        return { error: "Could not record the sale" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        quantity: t.Number(),
        date: t.String(),
        note: t.Optional(t.String()),
      }),
    },
  );

export default inventoryRoutes;
