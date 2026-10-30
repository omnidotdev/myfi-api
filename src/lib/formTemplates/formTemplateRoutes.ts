import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { formTemplateTable } from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { setDefaultFormTemplate } from "./setDefaultFormTemplate";

const DOCUMENT_TYPES = ["invoice", "estimate"];

/**
 * Custom form templates (branding/layout) for invoices and estimates.
 * Book-scoped (viewer reads, editor writes) by the global bookAccessMiddleware
 * via bookId in the query or body; id-addressed routes resolve the owning book
 */
const formTemplateRoutes = new Elysia({ prefix: "/api/form-templates" })
  .get("/", async ({ query, set }) => {
    const { bookId, documentType } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const where = documentType
      ? and(
          eq(formTemplateTable.bookId, bookId),
          eq(formTemplateTable.documentType, documentType),
        )
      : eq(formTemplateTable.bookId, bookId);
    const templates = await dbPool
      .select()
      .from(formTemplateTable)
      .where(where);
    return { templates };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!DOCUMENT_TYPES.includes(body.documentType)) {
        set.status = 400;
        return {
          error: `documentType must be one of ${DOCUMENT_TYPES.join(", ")}`,
        };
      }
      const [template] = await dbPool
        .insert(formTemplateTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          documentType: body.documentType,
          accentColor: body.accentColor ?? "#0f172a",
          footerText: body.footerText ?? null,
          terms: body.terms ?? null,
          showLogo: body.showLogo ?? true,
        })
        .returning();
      set.status = 201;
      return { template };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        documentType: t.String(),
        accentColor: t.Optional(t.String()),
        footerText: t.Optional(t.String()),
        terms: t.Optional(t.String()),
        showLogo: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(formTemplateTable)
        .where(eq(formTemplateTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Form template not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.accentColor !== undefined)
        updates.accentColor = body.accentColor;
      if (body.footerText !== undefined) updates.footerText = body.footerText;
      if (body.terms !== undefined) updates.terms = body.terms;
      if (body.showLogo !== undefined) updates.showLogo = body.showLogo;

      const [template] = await dbPool
        .update(formTemplateTable)
        .set(updates)
        .where(eq(formTemplateTable.id, params.id))
        .returning();
      return { template };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        accentColor: t.Optional(t.String()),
        footerText: t.Optional(t.Union([t.String(), t.Null()])),
        terms: t.Optional(t.Union([t.String(), t.Null()])),
        showLogo: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(formTemplateTable)
        .where(eq(formTemplateTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Form template not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(formTemplateTable)
        .where(eq(formTemplateTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Make a template the default for its document type (bookId in body -> global
  // middleware guards editor)
  .post(
    "/:id/default",
    async ({ params, body, set }) => {
      try {
        await setDefaultFormTemplate(body.bookId, params.id);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        set.status = /not found/i.test(message) ? 404 : 500;
        return { error: message };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  );

export default formTemplateRoutes;
