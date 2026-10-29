import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { materializeRecurringInvoices } from "./materializeRecurringInvoices";
import {
  createRecurringInvoice,
  deleteRecurringInvoice,
  getRecurringInvoice,
  listRecurringInvoices,
  updateRecurringInvoice,
} from "./recurringInvoiceService";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Business-rule failures safe to surface to the user; anything else is treated
// as an unexpected error and returned generically (never leak internals)
const isClientError = (message: string): boolean =>
  /Invalid frequency|YYYY-MM-DD|at least one line/i.test(message);

const lineSchema = t.Object({
  description: t.String(),
  quantity: t.Number(),
  unitPrice: t.Number(),
  incomeAccountId: t.String(),
  taxJurisdictionId: t.Optional(t.Nullable(t.String())),
  discountPercent: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
});

/**
 * Recurring-invoice template routes. A template generates DRAFT invoices on a
 * schedule (weekly/biweekly/monthly/quarterly/yearly); a scheduler runs daily
 * and a manual run endpoint materializes on demand. The generated invoices are
 * drafts and do not post to the ledger until a user posts them. Book access is
 * enforced by the global bookAccessMiddleware from the bookId in query/body;
 * id-addressed routes re-check ownership inside the service (IDOR guard)
 */
const recurringInvoiceRoutes = new Elysia({
  prefix: "/api/recurring-invoices",
})
  // Generate due drafts now for a book (through today, or a given asOf date)
  .post(
    "/run",
    async ({ body }) => {
      const asOf =
        body.asOf && ISO_DATE.test(body.asOf)
          ? body.asOf
          : new Date().toISOString().slice(0, 10);
      return materializeRecurringInvoices({ asOf, bookId: body.bookId });
    },
    {
      body: t.Object({ bookId: t.String(), asOf: t.Optional(t.String()) }),
    },
  )
  // List a book's templates
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const recurringInvoices = await listRecurringInvoices(bookId);
    return { recurringInvoices };
  })
  // Get one template with its lines
  .get(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }
      const found = await getRecurringInvoice(params.id, bookId);
      if (!found) {
        set.status = 404;
        return { error: "Recurring invoice not found" };
      }
      return found;
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Create a template with line items
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const { template, lines } = await createRecurringInvoice(body);
        set.status = 201;
        emitAudit({
          type: "myfi.recurring_invoice.created",
          organizationId: body.bookId,
          resource: { type: "recurring_invoice", id: template.id },
          data: { bookId: body.bookId, frequency: body.frequency },
        });
        return { recurringInvoice: template, lines };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[recurring-invoices] create failed:", err);
        set.status = 500;
        return { error: "Could not create the recurring invoice" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.String(),
        numberPrefix: t.Optional(t.String()),
        frequency: t.String(),
        nextRunDate: t.String(),
        dueInDays: t.Optional(t.Integer({ minimum: 0 })),
        currency: t.Optional(t.String()),
        memo: t.Optional(t.Nullable(t.String())),
        lines: t.Array(lineSchema),
      }),
    },
  )
  // Update a template (and optionally replace its lines)
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const updated = await updateRecurringInvoice(params.id, body.bookId, {
          numberPrefix: body.numberPrefix,
          frequency: body.frequency,
          nextRunDate: body.nextRunDate,
          dueInDays: body.dueInDays,
          currency: body.currency,
          memo: body.memo,
          isActive: body.isActive,
          lines: body.lines,
        });
        if (!updated) {
          set.status = 404;
          return { error: "Recurring invoice not found" };
        }
        return { recurringInvoice: updated.template, lines: updated.lines };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[recurring-invoices] update failed:", err);
        set.status = 500;
        return { error: "Could not update the recurring invoice" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        numberPrefix: t.Optional(t.String()),
        frequency: t.Optional(t.String()),
        nextRunDate: t.Optional(t.String()),
        dueInDays: t.Optional(t.Integer({ minimum: 0 })),
        currency: t.Optional(t.String()),
        memo: t.Optional(t.Nullable(t.String())),
        isActive: t.Optional(t.Boolean()),
        lines: t.Optional(t.Array(lineSchema)),
      }),
    },
  )
  // Delete a template (addressed by id, so re-check book access here)
  .delete(
    "/:id",
    async ({ params, body, set, request }) => {
      const auth = await authorizeBook(request, body.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };
      const deleted = await deleteRecurringInvoice(params.id, body.bookId);
      if (!deleted) {
        set.status = 404;
        return { error: "Recurring invoice not found" };
      }
      emitAudit({
        type: "myfi.recurring_invoice.deleted",
        organizationId: body.bookId,
        resource: { type: "recurring_invoice", id: params.id },
      });
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  );

export default recurringInvoiceRoutes;
