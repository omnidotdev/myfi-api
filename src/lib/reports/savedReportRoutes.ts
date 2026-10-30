import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { savedReportTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

/**
 * Saved (memorized) reports: a named report type plus the parameters to re-run
 * it. Book-scoped (viewer reads, editor writes) by the global
 * bookAccessMiddleware via bookId in the query or body; id-addressed routes
 * resolve the owning book themselves
 */
const savedReportRoutes = new Elysia({ prefix: "/api/saved-reports" })
  .get("/", async ({ query, set }) => {
    const { bookId, reportType } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const rows = await dbPool
      .select()
      .from(savedReportTable)
      .where(eq(savedReportTable.bookId, bookId))
      .orderBy(desc(savedReportTable.createdAt));
    const savedReports = reportType
      ? rows.filter((r) => r.reportType === reportType)
      : rows;
    return { savedReports };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [savedReport] = await dbPool
        .insert(savedReportTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          reportType: body.reportType,
          params: (body.params ?? {}) as Record<string, unknown>,
        })
        .returning();
      set.status = 201;
      return { savedReport };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        reportType: t.String(),
        params: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(savedReportTable)
        .where(eq(savedReportTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Saved report not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(savedReportTable)
        .where(eq(savedReportTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export default savedReportRoutes;
