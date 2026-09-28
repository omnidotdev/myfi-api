import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

// Columns safe to return to clients: never the encrypted `accessToken` (the
// Plaid/OFX credential blob). Used by every read AND every write's .returning()
const publicConnectionColumns = {
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
};

// Connected account routes
const connectionRoutes = new Elysia({ prefix: "/api/connections" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const connections = await dbPool
      .select(publicConnectionColumns)
      .from(connectedAccountTable)
      .where(eq(connectedAccountTable.bookId, bookId));

    return { connections };
  })
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({
          id: connectedAccountTable.id,
          bookId: connectedAccountTable.bookId,
          institutionName: connectedAccountTable.institutionName,
        })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Connected account not found" };
      }

      // Addressed by connection id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on the connection's book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const [connection] = await dbPool
        .update(connectedAccountTable)
        .set({ accountId: body.accountId })
        .where(eq(connectedAccountTable.id, id))
        .returning(publicConnectionColumns);

      emitAudit({
        type: "myfi.connection.linked",
        organizationId: existing.bookId,
        resource: {
          type: "connected_account",
          id: params.id,
          name: existing.institutionName ?? undefined,
        },
      });

      return { connection };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        accountId: t.Union([t.String(), t.Null()]),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({
          id: connectedAccountTable.id,
          bookId: connectedAccountTable.bookId,
          institutionName: connectedAccountTable.institutionName,
        })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Connected account not found" };
      }

      // Addressed by connection id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on the connection's book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      // Soft-delete: set status to disconnected instead of removing
      const [connection] = await dbPool
        .update(connectedAccountTable)
        .set({ status: "disconnected" })
        .where(eq(connectedAccountTable.id, id))
        .returning(publicConnectionColumns);

      emitAudit({
        type: "myfi.connection.unlinked",
        organizationId: existing.bookId,
        resource: {
          type: "connected_account",
          id: params.id,
          name: existing.institutionName ?? undefined,
        },
      });

      return { connection };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default connectionRoutes;
