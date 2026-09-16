import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { customerTable, invoiceLineTable, invoiceTable } from "lib/db/schema";
import {
  MANTLE_MANAGED_MESSAGE,
  isMantleManaged,
} from "lib/mantle/invoiceSource";
import { createInvoiceDraft } from "./createInvoiceDraft";
import { postInvoice } from "./postInvoice";
import { recordInvoicePayment } from "./recordInvoicePayment";
import { voidInvoice } from "./voidInvoice";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Business-rule failures safe to surface to the user; anything else is treated
// as an unexpected error and returned generically (never leak internals)
const isClientError = (message: string): boolean =>
  /not found|no lines|at least one line|Accounts Receivable|balance|positive|posted, unpaid|payments|Deposit account/i.test(
    message,
  );

/**
 * Customer invoicing actions that post to the ledger. Reads (customers,
 * invoices, lines, payments) are served by PostGraphile; these routes cover the
 * side-effecting transitions. Book access is enforced by the global
 * bookAccessMiddleware from the bookId in the body, and each action re-checks
 * that the invoice belongs to that book (IDOR guard) inside the service
 */
const invoiceRoutes = new Elysia({ prefix: "/api/invoices" })
  // List invoices for a book (newest first) with the customer name and balance
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rows = await dbPool
      .select({
        id: invoiceTable.id,
        number: invoiceTable.number,
        status: invoiceTable.status,
        issueDate: invoiceTable.issueDate,
        dueDate: invoiceTable.dueDate,
        total: invoiceTable.total,
        amountPaid: invoiceTable.amountPaid,
        customerId: invoiceTable.customerId,
        customerName: customerTable.name,
      })
      .from(invoiceTable)
      .innerJoin(customerTable, eq(invoiceTable.customerId, customerTable.id))
      .where(eq(invoiceTable.bookId, bookId))
      .orderBy(desc(invoiceTable.issueDate));

    return {
      invoices: rows.map((r) => ({
        ...r,
        balanceDue: (Number(r.total) - Number(r.amountPaid)).toFixed(4),
      })),
    };
  })
  // Get one invoice with its line items
  .get(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const [invoice] = await dbPool
        .select()
        .from(invoiceTable)
        .where(eq(invoiceTable.id, params.id));
      // Generic ownership guard (IDOR)
      if (!invoice || invoice.bookId !== bookId) {
        set.status = 404;
        return { error: "Invoice not found" };
      }

      const lines = await dbPool
        .select()
        .from(invoiceLineTable)
        .where(eq(invoiceLineTable.invoiceId, params.id))
        .orderBy(invoiceLineTable.sortOrder);

      return { invoice, lines };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // Create a draft invoice with line items
  .post(
    "/",
    async ({ body, set }) => {
      if (await isMantleManaged(body.bookId)) {
        set.status = 409;
        return { error: MANTLE_MANAGED_MESSAGE };
      }
      try {
        const result = await createInvoiceDraft(body);
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[invoices] create failed:", err);
        set.status = 500;
        return { error: "Could not create the invoice" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.String(),
        number: t.String(),
        issueDate: t.String(),
        dueDate: t.String(),
        memo: t.Optional(t.String()),
        terms: t.Optional(t.String()),
        lines: t.Array(
          t.Object({
            description: t.String(),
            quantity: t.Number(),
            unitPrice: t.Number(),
            incomeAccountId: t.String(),
            taxJurisdictionId: t.Optional(t.String()),
            inventoryItemId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  // Post a draft invoice to the ledger
  .post(
    "/:id/post",
    async ({ params, body, set }) => {
      if (await isMantleManaged(body.bookId)) {
        set.status = 409;
        return { error: MANTLE_MANAGED_MESSAGE };
      }
      try {
        const result = await postInvoice(params.id, body.bookId);
        emitAudit({
          type: "myfi.invoice.posted",
          organizationId: body.bookId,
          resource: { type: "invoice", id: params.id },
          data: { total: result.total },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Post failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[invoices] post failed:", err);
        set.status = 500;
        return { error: "Could not post the invoice" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  )
  // Record a payment (receipt) against a posted invoice
  .post(
    "/:id/payments",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        const result = await recordInvoicePayment({
          invoiceId: params.id,
          bookId: body.bookId,
          amount: body.amount,
          depositAccountId: body.depositAccountId,
          date: body.date,
          method: body.method,
          reference: body.reference,
        });
        emitAudit({
          type: "myfi.invoice.payment_recorded",
          organizationId: body.bookId,
          resource: { type: "invoice", id: params.id },
          data: { amount: body.amount, status: result.invoiceStatus },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[invoices] payment failed:", err);
        set.status = 500;
        return { error: "Could not record the payment" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        amount: t.Number(),
        depositAccountId: t.String(),
        date: t.String(),
        method: t.Optional(t.String()),
        reference: t.Optional(t.String()),
      }),
    },
  )
  // Void an invoice (reverses its ledger entry; refused if it has payments)
  .post(
    "/:id/void",
    async ({ params, body, set }) => {
      try {
        const result = await voidInvoice(params.id, body.bookId);
        emitAudit({
          type: "myfi.invoice.voided",
          organizationId: body.bookId,
          resource: { type: "invoice", id: params.id },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Void failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[invoices] void failed:", err);
        set.status = 500;
        return { error: "Could not void the invoice" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  );

export default invoiceRoutes;
