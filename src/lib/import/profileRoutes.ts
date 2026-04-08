import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { importProfileTable } from "lib/db/schema";

const profileRoutes = new Elysia({ prefix: "/api/import/profiles" })
  .get(
    "/",
    async ({ query }) => {
      const profiles = await dbPool
        .select()
        .from(importProfileTable)
        .where(eq(importProfileTable.bookId, query.bookId));

      return { profiles };
    },
    {
      query: t.Object({ bookId: t.String() }),
    },
  )
  .post(
    "/",
    async ({ body }) => {
      const [profile] = await dbPool
        .insert(importProfileTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          columnMap: body.columnMap,
          headerRows: body.headerRows ?? "1",
        })
        .returning();

      return { profile };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        columnMap: t.Any(),
        headerRows: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      await dbPool
        .delete(importProfileTable)
        .where(eq(importProfileTable.id, params.id));

      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default profileRoutes;
