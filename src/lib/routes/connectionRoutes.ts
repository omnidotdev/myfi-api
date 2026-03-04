import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";

// Connected account routes
const connectionRoutes = new Elysia({ prefix: "/api/connections" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const connections = await dbPool
      .select({
        id: connectedAccountTable.id,
        bookId: connectedAccountTable.bookId,
        provider: connectedAccountTable.provider,
        providerAccountId: connectedAccountTable.providerAccountId,
        accountId: connectedAccountTable.accountId,
        institutionName: connectedAccountTable.institutionName,
        mask: connectedAccountTable.mask,
        status: connectedAccountTable.status,
        lastSyncedAt: connectedAccountTable.lastSyncedAt,
        createdAt: connectedAccountTable.createdAt,
      })
      .from(connectedAccountTable)
      .where(eq(connectedAccountTable.bookId, bookId));

    return { connections };
  })
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: connectedAccountTable.id })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Connected account not found" };
      }

      // Soft-delete: set status to disconnected instead of removing
      const [connection] = await dbPool
        .update(connectedAccountTable)
        .set({ status: "disconnected" })
        .where(eq(connectedAccountTable.id, id))
        .returning();

      return { connection };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default connectionRoutes;
