import { and, eq, inArray, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineProjectTable,
  journalLineTable,
  projectTable,
} from "lib/db/schema";

/**
 * Compute total expense spend assigned to a given project by summing
 * debits minus credits on expense-type journal lines linked to the project.
 */
const getTotalSpend = async (projectId: string): Promise<number> => {
  const [totals] = await dbPool
    .select({
      totalDebit: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalLineProjectTable,
      eq(journalLineTable.id, journalLineProjectTable.journalLineId),
    )
    .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
    .where(
      and(
        eq(journalLineProjectTable.projectId, projectId),
        eq(accountTable.type, "expense"),
      ),
    );

  return Number(totals?.totalDebit ?? 0) - Number(totals?.totalCredit ?? 0);
};

// Project CRUD and journal line project assignment routes
const projectRoutes = new Elysia({ prefix: "/api/projects" })
  .get("/", async ({ query, set }) => {
    const { bookId, status } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const whereClause = status
      ? and(eq(projectTable.bookId, bookId), eq(projectTable.status, status))
      : eq(projectTable.bookId, bookId);

    const projects = await dbPool
      .select()
      .from(projectTable)
      .where(whereClause);

    const enriched = await Promise.all(
      projects.map(async (project) => {
        const totalSpend = await getTotalSpend(project.id);
        const budgetRemaining =
          project.budgetAmount !== null
            ? Number(project.budgetAmount) - totalSpend
            : null;

        return {
          ...project,
          totalSpend,
          budgetRemaining,
        };
      }),
    );

    return { projects: enriched };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [project] = await dbPool
        .insert(projectTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          code: body.code ?? null,
          status: body.status ?? "active",
          budgetAmount: body.budgetAmount ?? null,
          startDate: body.startDate ?? null,
          endDate: body.endDate ?? null,
          notes: body.notes ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.project.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "project", id: project.id, name: project.name },
        data: { bookId: body.bookId },
      });

      return { project };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        code: t.Optional(t.String()),
        status: t.Optional(t.String()),
        budgetAmount: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(projectTable)
        .where(eq(projectTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Project not found" };
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.status !== undefined) updates.status = body.status;
      if (body.budgetAmount !== undefined)
        updates.budgetAmount = body.budgetAmount;
      if (body.startDate !== undefined) updates.startDate = body.startDate;
      if (body.endDate !== undefined) updates.endDate = body.endDate;
      if (body.notes !== undefined) updates.notes = body.notes;

      const [project] = await dbPool
        .update(projectTable)
        .set(updates)
        .where(eq(projectTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.project.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "project", id: project.id, name: project.name },
        data: { bookId: existing.bookId },
      });

      return { project };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        code: t.Optional(t.String()),
        status: t.Optional(t.String()),
        budgetAmount: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(projectTable)
        .where(eq(projectTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Project not found" };
      }

      await dbPool.delete(projectTable).where(eq(projectTable.id, params.id));

      emitAudit({
        type: "myfi.project.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "project", id: existing.id, name: existing.name },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/complete",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(projectTable)
        .where(eq(projectTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Project not found" };
      }

      const [project] = await dbPool
        .update(projectTable)
        .set({ status: "completed" })
        .where(eq(projectTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.project.status_changed",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "project", id: project.id, name: project.name },
        data: { bookId: existing.bookId, status: "completed" },
      });

      return { project };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/archive",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(projectTable)
        .where(eq(projectTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Project not found" };
      }

      const [project] = await dbPool
        .update(projectTable)
        .set({ status: "archived" })
        .where(eq(projectTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.project.status_changed",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "project", id: project.id, name: project.name },
        data: { bookId: existing.bookId, status: "archived" },
      });

      return { project };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/line-assignments",
    async ({ body, set }) => {
      /**
       * Tenancy check: ensure every referenced project and journal line
       * belong to the same book before inserting. Project rows carry
       * bookId directly, journal lines inherit it via their parent
       * journal_entry. Mixing books in a single bulk request would
       * violate multi-tenant isolation, so we require all ids in the
       * payload to resolve to exactly one shared bookId.
       */
      const projectIds = [
        ...new Set(body.assignments.map((a) => a.projectId)),
      ];
      const journalLineIds = [
        ...new Set(body.assignments.map((a) => a.journalLineId)),
      ];

      const [projects, lines] = await Promise.all([
        dbPool
          .select({
            id: projectTable.id,
            bookId: projectTable.bookId,
          })
          .from(projectTable)
          .where(inArray(projectTable.id, projectIds)),
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
        projects.length !== projectIds.length ||
        lines.length !== journalLineIds.length
      ) {
        set.status = 400;
        return { error: "All assignments must be within the same book" };
      }

      const bookIds = new Set<string>([
        ...projects.map((p) => p.bookId),
        ...lines.map((l) => l.bookId),
      ]);

      if (bookIds.size !== 1) {
        set.status = 400;
        return { error: "All assignments must be within the same book" };
      }

      const rows = await dbPool
        .insert(journalLineProjectTable)
        .values(
          body.assignments.map((a) => ({
            journalLineId: a.journalLineId,
            projectId: a.projectId,
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
            projectId: t.String(),
          }),
        ),
      }),
    },
  )
  .delete(
    "/line-assignments/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(journalLineProjectTable)
        .where(eq(journalLineProjectTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Assignment not found" };
      }

      await dbPool
        .delete(journalLineProjectTable)
        .where(eq(journalLineProjectTable.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default projectRoutes;
