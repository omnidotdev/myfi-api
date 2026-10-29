import { and, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  journalLineTrackingCategoryTable,
  trackingCategoryTable,
} from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

const VALID_KINDS = ["class", "location"];

/**
 * Tracking categories (QuickBooks-style Class and Location) and their
 * assignment to journal lines for segment reporting. CRUD on the definitions is
 * book-scoped (viewer reads, editor writes) by the global bookAccessMiddleware
 * via the bookId in the query or body; routes addressed by an id carry no
 * bookId, so they resolve the owning book and call authorizeBook themselves
 */
const trackingCategoryRoutes = new Elysia({
  prefix: "/api/tracking-categories",
})
  .get("/", async ({ query, set }) => {
    const { bookId, kind } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const where = kind
      ? and(
          eq(trackingCategoryTable.bookId, bookId),
          eq(trackingCategoryTable.kind, kind),
        )
      : eq(trackingCategoryTable.bookId, bookId);
    const categories = await dbPool
      .select()
      .from(trackingCategoryTable)
      .where(where);
    return { categories };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!VALID_KINDS.includes(body.kind)) {
        set.status = 400;
        return { error: `kind must be one of ${VALID_KINDS.join(", ")}` };
      }
      const [category] = await dbPool
        .insert(trackingCategoryTable)
        .values({
          bookId: body.bookId,
          kind: body.kind,
          name: body.name,
          code: body.code ?? null,
        })
        .returning();
      set.status = 201;
      return { category };
    },
    {
      body: t.Object({
        bookId: t.String(),
        kind: t.String(),
        name: t.String(),
        code: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(trackingCategoryTable)
        .where(eq(trackingCategoryTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Tracking category not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      const [category] = await dbPool
        .update(trackingCategoryTable)
        .set(updates)
        .where(eq(trackingCategoryTable.id, params.id))
        .returning();
      return { category };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        code: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(trackingCategoryTable)
        .where(eq(trackingCategoryTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Tracking category not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(trackingCategoryTable)
        .where(eq(trackingCategoryTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Assign categories to journal lines (bulk). All ids must be in one book
  .post(
    "/line-assignments",
    async ({ body, set, request }) => {
      const categoryIds = [
        ...new Set(body.assignments.map((a) => a.trackingCategoryId)),
      ];
      const journalLineIds = [
        ...new Set(body.assignments.map((a) => a.journalLineId)),
      ];

      const [categories, lines] = await Promise.all([
        dbPool
          .select({
            id: trackingCategoryTable.id,
            bookId: trackingCategoryTable.bookId,
          })
          .from(trackingCategoryTable)
          .where(inArray(trackingCategoryTable.id, categoryIds)),
        dbPool
          .select({
            id: journalLineTable.id,
            bookId: journalEntryTable.bookId,
          })
          .from(journalLineTable)
          .innerJoin(
            journalEntryTable,
            eq(journalLineTable.journalEntryId, journalEntryTable.id),
          )
          .where(inArray(journalLineTable.id, journalLineIds)),
      ]);

      if (
        categories.length !== categoryIds.length ||
        lines.length !== journalLineIds.length
      ) {
        set.status = 400;
        return { error: "All assignments must be within the same book" };
      }

      const bookIds = new Set<string>([
        ...categories.map((c) => c.bookId),
        ...lines.map((l) => l.bookId),
      ]);
      if (bookIds.size !== 1) {
        set.status = 400;
        return { error: "All assignments must be within the same book" };
      }

      const [resolvedBookId] = [...bookIds];
      const auth = await authorizeBook(request, resolvedBookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const rows = await dbPool
        .insert(journalLineTrackingCategoryTable)
        .values(
          body.assignments.map((a) => ({
            journalLineId: a.journalLineId,
            trackingCategoryId: a.trackingCategoryId,
          })),
        )
        .onConflictDoNothing()
        .returning();

      return { success: true, count: rows.length };
    },
    {
      body: t.Object({
        assignments: t.Array(
          t.Object({
            journalLineId: t.String(),
            trackingCategoryId: t.String(),
          }),
        ),
      }),
    },
  )
  .delete(
    "/line-assignments/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select({
          id: journalLineTrackingCategoryTable.id,
          bookId: trackingCategoryTable.bookId,
        })
        .from(journalLineTrackingCategoryTable)
        .innerJoin(
          trackingCategoryTable,
          eq(
            journalLineTrackingCategoryTable.trackingCategoryId,
            trackingCategoryTable.id,
          ),
        )
        .where(eq(journalLineTrackingCategoryTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Assignment not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(journalLineTrackingCategoryTable)
        .where(eq(journalLineTrackingCategoryTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export default trackingCategoryRoutes;
