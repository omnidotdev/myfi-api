import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { bookAccessTable } from "lib/db/schema";

// Book access management routes
const bookAccessRoutes = new Elysia({ prefix: "/api/book-access" })
  // List access records for a book
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const records = await dbPool
      .select()
      .from(bookAccessTable)
      .where(eq(bookAccessTable.bookId, bookId));

    return { records };
  })
  // Create access record
  .post(
    "/",
    async ({ body, set }) => {
      const [record] = await dbPool
        .insert(bookAccessTable)
        .values({
          bookId: body.bookId,
          userId: body.userId,
          role: body.role,
          invitedBy: body.invitedBy ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.book_access.created",
        organizationId: body.bookId,
        actor: { id: body.invitedBy ?? "unknown" },
        resource: { type: "book_access", id: record.id, name: body.userId },
        data: { bookId: body.bookId, role: body.role },
      });

      return { record };
    },
    {
      body: t.Object({
        bookId: t.String(),
        userId: t.String(),
        role: t.Union([
          t.Literal("owner"),
          t.Literal("editor"),
          t.Literal("viewer"),
        ]),
        invitedBy: t.Optional(t.String()),
      }),
    },
  )
  // Update role
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Access record not found" };
      }

      const [record] = await dbPool
        .update(bookAccessTable)
        .set({ role: body.role })
        .where(eq(bookAccessTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.book_access.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "book_access",
          id: record.id,
          name: record.userId,
        },
        data: {
          bookId: existing.bookId,
          previousRole: existing.role,
          newRole: body.role,
        },
      });

      return { record };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        role: t.Union([
          t.Literal("owner"),
          t.Literal("editor"),
          t.Literal("viewer"),
        ]),
      }),
    },
  )
  // Remove access
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Access record not found" };
      }

      await dbPool
        .delete(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      emitAudit({
        type: "myfi.book_access.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "book_access",
          id: existing.id,
          name: existing.userId,
        },
        data: { bookId: existing.bookId, role: existing.role },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default bookAccessRoutes;
