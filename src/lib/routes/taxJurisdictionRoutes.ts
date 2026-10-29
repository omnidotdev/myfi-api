import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  billLineTable,
  estimateLineTable,
  invoiceLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { recordSalesTaxPayment } from "lib/tax/recordSalesTaxPayment";

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
      // The rate drives the tax computed on every line that points at this
      // jurisdiction; without it the jurisdiction silently charges 0% tax
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate < 0) {
        set.status = 400;
        return { error: "rate must be a non-negative number" };
      }

      const [jurisdiction] = await dbPool
        .insert(taxJurisdictionTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          code: body.code ?? null,
          filingFrequency: body.filingFrequency,
          taxPayableAccountId: body.taxPayableAccountId,
          rate: body.rate,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.tax_jurisdiction.created",
        organizationId: body.bookId,
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
        // Tax rate as a fraction string, e.g. "0.0825" for 8.25%
        rate: t.String(),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tax jurisdiction not found" };
      }

      // Addressed by jurisdiction id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on its own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.code !== undefined) updates.code = body.code;
      if (body.filingFrequency !== undefined)
        updates.filingFrequency = body.filingFrequency;
      if (body.taxPayableAccountId !== undefined)
        updates.taxPayableAccountId = body.taxPayableAccountId;
      if (body.rate !== undefined) {
        const rate = Number(body.rate);
        if (!Number.isFinite(rate) || rate < 0) {
          set.status = 400;
          return { error: "rate must be a non-negative number" };
        }
        updates.rate = body.rate;
      }

      const [jurisdiction] = await dbPool
        .update(taxJurisdictionTable)
        .set(updates)
        .where(eq(taxJurisdictionTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.tax_jurisdiction.updated",
        organizationId: existing.bookId,
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
        rate: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tax jurisdiction not found" };
      }

      // Addressed by jurisdiction id, not a `bookId` field, so the global
      // middleware does not guard it: require editor on its own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      // Refuse deletion while any line references the jurisdiction: a dangling
      // reference makes that line post with zero tax (the leftJoin rate is null)
      const [invoiceRef] = await dbPool
        .select({ id: invoiceLineTable.id })
        .from(invoiceLineTable)
        .where(eq(invoiceLineTable.taxJurisdictionId, params.id))
        .limit(1);
      const [billRef] = await dbPool
        .select({ id: billLineTable.id })
        .from(billLineTable)
        .where(eq(billLineTable.taxJurisdictionId, params.id))
        .limit(1);
      const [estimateRef] = await dbPool
        .select({ id: estimateLineTable.id })
        .from(estimateLineTable)
        .where(eq(estimateLineTable.taxJurisdictionId, params.id))
        .limit(1);
      if (invoiceRef || billRef || estimateRef) {
        set.status = 409;
        return {
          error:
            "Cannot delete a tax jurisdiction referenced by invoice, bill, or estimate lines",
        };
      }

      await dbPool
        .delete(taxJurisdictionTable)
        .where(eq(taxJurisdictionTable.id, params.id));

      emitAudit({
        type: "myfi.tax_jurisdiction.deleted",
        organizationId: existing.bookId,
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
  )
  // Record a remittance to this jurisdiction's tax agency
  .post(
    "/:id/payments",
    async ({ params, body, set }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        const result = await recordSalesTaxPayment({
          bookId: body.bookId,
          jurisdictionId: params.id,
          amount: body.amount,
          paymentAccountId: body.paymentAccountId,
          date: body.date,
          memo: body.memo,
        });
        emitAudit({
          type: "myfi.tax_jurisdiction.payment",
          organizationId: body.bookId,
          resource: { type: "tax_jurisdiction", id: params.id },
          data: { amount: body.amount },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed";
        if (/positive|not found|closed period/i.test(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[tax-jurisdictions] payment failed:", err);
        set.status = 500;
        return { error: "Could not record the tax payment" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        amount: t.Number(),
        paymentAccountId: t.String(),
        date: t.String(),
        memo: t.Optional(t.String()),
      }),
    },
  );

export default taxJurisdictionRoutes;
