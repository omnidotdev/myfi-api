import { asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { transferFunds } from "lib/accounting/transferFunds";
import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

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

      emitAudit({
        type: "myfi.account.created",
        organizationId: body.bookId,
        resource: { type: "account", id: account.id, name: account.name },
        data: { bookId: body.bookId, accountType: body.type },
      });

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
    async ({ params, body, set, request }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({
          id: accountTable.id,
          bookId: accountTable.bookId,
        })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      // Addressed by account id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on the account's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

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

      emitAudit({
        type: "myfi.account.updated",
        organizationId: existing.bookId,
        resource: { type: "account", id: params.id, name: account.name },
      });

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
    async ({ params, set, request }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({
          id: accountTable.id,
          bookId: accountTable.bookId,
          name: accountTable.name,
          isActive: accountTable.isActive,
        })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      // Addressed by account id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on the account's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const [account] = await dbPool
        .update(accountTable)
        .set({
          isActive: !existing.isActive,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accountTable.id, id))
        .returning();

      emitAudit({
        type: existing.isActive
          ? "myfi.account.deactivated"
          : "myfi.account.updated",
        organizationId: existing.bookId,
        resource: { type: "account", id: params.id, name: existing.name },
      });

      return { account };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({
          id: accountTable.id,
          bookId: accountTable.bookId,
          name: accountTable.name,
        })
        .from(accountTable)
        .where(eq(accountTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Account not found" };
      }

      // Addressed by account id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on the account's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool.delete(accountTable).where(eq(accountTable.id, id));

      emitAudit({
        type: "myfi.account.deleted",
        organizationId: existing.bookId,
        resource: {
          type: "account",
          id: existing.id,
          name: existing.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // Transfer money between two of the book's accounts (one balanced entry)
  .post(
    "/transfer",
    async ({ body, set }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        const result = await transferFunds({
          bookId: body.bookId,
          fromAccountId: body.fromAccountId,
          toAccountId: body.toAccountId,
          amount: body.amount,
          date: body.date,
          memo: body.memo,
        });
        emitAudit({
          type: "myfi.account.transfer",
          organizationId: body.bookId,
          resource: { type: "account", id: body.fromAccountId },
          data: { toAccountId: body.toAccountId, amount: body.amount },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transfer failed";
        if (/positive|same account|belong to this book|closed period/i.test(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[accounts] transfer failed:", err);
        set.status = 500;
        return { error: "Could not record the transfer" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        fromAccountId: t.String(),
        toAccountId: t.String(),
        amount: t.Number(),
        date: t.String(),
        memo: t.Optional(t.String()),
      }),
    },
  );

export default accountRoutes;
