import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { customerTable, estimateLineTable, estimateTable } from "lib/db/schema";
import { convertEstimateToInvoice } from "./convertEstimateToInvoice";
import { createEstimateDraft } from "./createEstimateDraft";
import { updateEstimateStatus } from "./updateEstimateStatus";

import type { SettableEstimateStatus } from "./updateEstimateStatus";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isClientError = (message: string): boolean =>
  /not found|at least one line|no lines|declined|converted|Invalid/i.test(
    message,
  );

/**
 * Estimate (quote) routes. Reads are book-scoped and ownership-guarded; book
 * access is enforced by the global bookAccessMiddleware. Estimates do not post to
 * the ledger; converting one produces a draft invoice that does
 */
const estimateRoutes = new Elysia({ prefix: "/api/estimates" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rows = await dbPool
      .select({
        id: estimateTable.id,
        number: estimateTable.number,
        status: estimateTable.status,
        estimateDate: estimateTable.estimateDate,
        expiryDate: estimateTable.expiryDate,
        total: estimateTable.total,
        customerId: estimateTable.customerId,
        customerName: customerTable.name,
        convertedInvoiceId: estimateTable.convertedInvoiceId,
      })
      .from(estimateTable)
      .innerJoin(customerTable, eq(estimateTable.customerId, customerTable.id))
      .where(eq(estimateTable.bookId, bookId))
      .orderBy(desc(estimateTable.estimateDate));

    return { estimates: rows };
  })
  .get(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const [estimate] = await dbPool
        .select()
        .from(estimateTable)
        .where(eq(estimateTable.id, params.id));
      if (!estimate || estimate.bookId !== bookId) {
        set.status = 404;
        return { error: "Estimate not found" };
      }

      const lines = await dbPool
        .select()
        .from(estimateLineTable)
        .where(eq(estimateLineTable.estimateId, params.id))
        .orderBy(estimateLineTable.sortOrder);

      return { estimate, lines };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createEstimateDraft(body);
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[estimates] create failed:", err);
        set.status = 500;
        return { error: "Could not create the estimate" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.String(),
        number: t.String(),
        estimateDate: t.String(),
        expiryDate: t.Optional(t.String()),
        memo: t.Optional(t.String()),
        terms: t.Optional(t.String()),
        lines: t.Array(
          t.Object({
            description: t.String(),
            quantity: t.Number(),
            unitPrice: t.Number(),
            incomeAccountId: t.String(),
            taxJurisdictionId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .post(
    "/:id/status",
    async ({ params, body, set }) => {
      try {
        return await updateEstimateStatus(
          params.id,
          body.bookId,
          body.status as SettableEstimateStatus,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[estimates] status update failed:", err);
        set.status = 500;
        return { error: "Could not update the estimate" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String(), status: t.String() }),
    },
  )
  .post(
    "/:id/convert",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.issueDate) || !ISO_DATE.test(body.dueDate)) {
        set.status = 400;
        return { error: "issueDate and dueDate must be YYYY-MM-DD dates" };
      }
      try {
        return await convertEstimateToInvoice({
          estimateId: params.id,
          bookId: body.bookId,
          invoiceNumber: body.invoiceNumber,
          issueDate: body.issueDate,
          dueDate: body.dueDate,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Convert failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[estimates] convert failed:", err);
        set.status = 500;
        return { error: "Could not convert the estimate" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        invoiceNumber: t.String(),
        issueDate: t.String(),
        dueDate: t.String(),
      }),
    },
  );

export default estimateRoutes;
