import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { taxJurisdictionTable } from "lib/db/schema";

// Tax jurisdiction CRUD routes
const taxJurisdictionRoutes = new Elysia({
  prefix: "/api/tax-jurisdictions",
})
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const jurisdictions = await dbPool
      .select()
      .from(taxJurisdictionTable)
      .where(eq(taxJurisdictionTable.bookId, bookId));

    return { jurisdictions };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [jurisdiction] = await dbPool
        .insert(taxJurisdictionTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          code: body.code ?? null,
          filingFrequency: body.filingFrequency,
          taxPayableAccountId: body.taxPayableAccountId,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.tax_jurisdiction.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "tax_jurisdiction",
          id: jurisdiction.id,
          name: jurisdiction.name,
        },
        data: { bookId: body.bookId },
      });

      return { jurisdiction };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        code: t.Optional(t.String()),
        filingFrequency: t.String(),
        taxPayableAccountId: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tax jurisdiction not found" };
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.filingFrequency !== undefined)
        updates.filingFrequency = body.filingFrequency;
      if (body.taxPayableAccountId !== undefined)
        updates.taxPayableAccountId = body.taxPayableAccountId;

      const [jurisdiction] = await dbPool
        .update(taxJurisdictionTable)
        .set(updates)
        .where(eq(taxJurisdictionTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.tax_jurisdiction.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "tax_jurisdiction",
          id: jurisdiction.id,
          name: jurisdiction.name,
        },
        data: { bookId: existing.bookId },
      });

      return { jurisdiction };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        code: t.Optional(t.String()),
        filingFrequency: t.Optional(t.String()),
        taxPayableAccountId: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tax jurisdiction not found" };
      }

      await dbPool
        .delete(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      emitAudit({
        type: "myfi.tax_jurisdiction.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: {
          type: "tax_jurisdiction",
          id: existing.id,
          name: existing.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default taxJurisdictionRoutes;
