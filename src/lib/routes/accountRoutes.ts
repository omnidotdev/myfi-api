import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

import type { InsertAccount } from "lib/db/schema";

// Account CRUD routes
const accountRoutes = new Elysia({ prefix: "/api/accounts" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const accounts = await dbPool
      .select({
        id: accountTable.id,
        name: accountTable.name,
        code: accountTable.code,
        type: accountTable.type,
        subType: accountTable.subType,
        parentId: accountTable.parentId,
        isPlaceholder: accountTable.isPlaceholder,
        isActive: accountTable.isActive,
      })
      .from(accountTable)
      .where(eq(accountTable.bookId, bookId))
      .orderBy(asc(accountTable.code));

    return { accounts };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [account] = await dbPool
        .insert(accountTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          code: body.code ?? null,
          type: body.type,
          subType: (body.subType as InsertAccount["subType"]) ?? null,
          parentId: body.parentId ?? null,
          isPlaceholder: body.isPlaceholder ?? false,
        })
        .returning();

      set.status = 201;

      return { account };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        code: t.Optional(t.String()),
        type: t.Union([
          t.Literal("asset"),
          t.Literal("liability"),
          t.Literal("equity"),
          t.Literal("revenue"),
          t.Literal("expense"),
        ]),
        subType: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
        isPlaceholder: t.Optional(t.Boolean()),
      }),
    },
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: accountTable.id })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      const [account] = await dbPool
        .update(accountTable)
        .set({
          name: body.name,
          code: body.code,
          type: body.type,
          subType: body.subType as InsertAccount["subType"],
          parentId: body.parentId,
          isPlaceholder: body.isPlaceholder,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accountTable.id, id))
        .returning();

      return { account };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        code: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal("asset"),
            t.Literal("liability"),
            t.Literal("equity"),
            t.Literal("revenue"),
            t.Literal("expense"),
          ]),
        ),
        subType: t.Optional(t.String()),
        parentId: t.Optional(t.Nullable(t.String())),
        isPlaceholder: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: accountTable.id, isActive: accountTable.isActive })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      const [account] = await dbPool
        .update(accountTable)
        .set({
          isActive: !existing.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accountTable.id, id))
        .returning();

      return { account };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: accountTable.id })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      await dbPool.delete(accountTable).where(eq(accountTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default accountRoutes;
