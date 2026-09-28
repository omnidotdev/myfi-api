import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { bookAccessTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

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
    async ({ request, body, set }) => {
      // Managing who can access a book is an owner-only action, and the
      // inviter is the authenticated caller (never a forgeable body field)
      const auth = await authorizeBook(request, body.bookId, "owner", set);
      if (!auth) return { error: "Forbidden" };

      const [record] = await dbPool
        .insert(bookAccessTable)
        .values({
          bookId: body.bookId,
          userId: body.userId,
          role: body.role,
          invitedBy: auth.userId,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.book_access.created",
        organizationId: body.bookId,
        actor: { id: auth.userId },
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
      }),
    },
  )
  // Update role
  .patch(
    "/:id",
    async ({ request, params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Access record not found" };
      }

      const auth = await authorizeBook(request, existing.bookId, "owner", set);
      if (!auth) return { error: "Forbidden" };

      const [record] = await dbPool
        .update(bookAccessTable)
        .set({ role: body.role })
        .where(eq(bookAccessTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.book_access.updated",
        organizationId: existing.bookId,
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
    async ({ request, params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Access record not found" };
      }

      const auth = await authorizeBook(request, existing.bookId, "owner", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(bookAccessTable)
        .where(eq(bookAccessTable.id, params.id));

      emitAudit({
        type: "myfi.book_access.deleted",
        organizationId: existing.bookId,
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
