import { Elysia, t } from "elysia";

import { postInvoice } from "./postInvoice";
import { recordInvoicePayment } from "./recordInvoicePayment";
import { voidInvoice } from "./voidInvoice";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Business-rule failures safe to surface to the user; anything else is treated
// as an unexpected error and returned generically (never leak internals)
const isClientError = (message: string): boolean =>
  /not found|no lines|Accounts Receivable|balance|positive|posted, unpaid|payments|Deposit account/i.test(
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
  // Post a draft invoice to the ledger
  .post(
    "/:id/post",
    async ({ params, body, set }) => {
      try {
        return await postInvoice(params.id, body.bookId);
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
        return await recordInvoicePayment({
          invoiceId: params.id,
          bookId: body.bookId,
          amount: body.amount,
          depositAccountId: body.depositAccountId,
          date: body.date,
          method: body.method,
          reference: body.reference,
        });
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
        return await voidInvoice(params.id, body.bookId);
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
