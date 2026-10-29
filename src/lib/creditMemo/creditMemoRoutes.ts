import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  creditMemoLineTable,
  creditMemoTable,
  customerTable,
} from "lib/db/schema";
import { applyCreditMemo } from "./applyCreditMemo";
import { createCreditMemoDraft } from "./createCreditMemoDraft";
import { postCreditMemo } from "./postCreditMemo";
import { voidCreditMemo } from "./voidCreditMemo";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Business-rule failures safe to surface; anything else is returned generically
const isClientError = (message: string): boolean =>
  /not found|at least one line|balance|positive|Accounts Receivable|different customers|applied|closed period|open or partially|posted credit memo/i.test(
    message,
  );

/**
 * Customer credit-memo actions that post to the ledger. Reads are served by
 * PostGraphile; these routes cover the side-effecting transitions. Book access
 * is enforced by the global bookAccessMiddleware from the bookId in the body or
 * query, and each action re-checks that the memo belongs to that book (IDOR
 * guard) inside the service
 */
const creditMemoRoutes = new Elysia({ prefix: "/api/credit-memos" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const rows = await dbPool
      .select({
        id: creditMemoTable.id,
        number: creditMemoTable.number,
        status: creditMemoTable.status,
        date: creditMemoTable.date,
        total: creditMemoTable.total,
        amountApplied: creditMemoTable.amountApplied,
        customerId: creditMemoTable.customerId,
        customerName: customerTable.name,
      })
      .from(creditMemoTable)
      .innerJoin(customerTable, eq(creditMemoTable.customerId, customerTable.id))
      .where(eq(creditMemoTable.bookId, bookId))
      .orderBy(desc(creditMemoTable.date));
    return {
      creditMemos: rows.map((r) => ({
        ...r,
        unapplied: (Number(r.total) - Number(r.amountApplied)).toFixed(4),
      })),
    };
  })
  .get(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }
      const [creditMemo] = await dbPool
        .select()
        .from(creditMemoTable)
        .where(eq(creditMemoTable.id, params.id));
      if (!creditMemo || creditMemo.bookId !== bookId) {
        set.status = 404;
        return { error: "Credit memo not found" };
      }
      const lines = await dbPool
        .select()
        .from(creditMemoLineTable)
        .where(eq(creditMemoLineTable.creditMemoId, params.id))
        .orderBy(creditMemoLineTable.sortOrder);
      return { creditMemo, lines };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createCreditMemoDraft(body);
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[credit-memos] create failed:", err);
        set.status = 500;
        return { error: "Could not create the credit memo" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        customerId: t.String(),
        number: t.String(),
        date: t.String(),
        memo: t.Optional(t.String()),
        currency: t.Optional(t.String()),
        exchangeRate: t.Optional(t.Number({ exclusiveMinimum: 0 })),
        lines: t.Array(
          t.Object({
            description: t.String(),
            quantity: t.Number(),
            unitPrice: t.Number(),
            incomeAccountId: t.String(),
            taxJurisdictionId: t.Optional(t.String()),
            discountPercent: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
            inventoryItemId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .post(
    "/:id/post",
    async ({ params, body, set }) => {
      try {
        const result = await postCreditMemo(params.id, body.bookId);
        emitAudit({
          type: "myfi.credit_memo.posted",
          organizationId: body.bookId,
          resource: { type: "credit_memo", id: params.id },
          data: { total: result.total },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Post failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[credit-memos] post failed:", err);
        set.status = 500;
        return { error: "Could not post the credit memo" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  )
  .post(
    "/:id/apply",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        const result = await applyCreditMemo({
          creditMemoId: params.id,
          invoiceId: body.invoiceId,
          bookId: body.bookId,
          amount: body.amount,
          date: body.date,
        });
        emitAudit({
          type: "myfi.credit_memo.applied",
          organizationId: body.bookId,
          resource: { type: "credit_memo", id: params.id },
          data: { invoiceId: body.invoiceId, amount: body.amount },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Apply failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[credit-memos] apply failed:", err);
        set.status = 500;
        return { error: "Could not apply the credit memo" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        invoiceId: t.String(),
        amount: t.Number(),
        date: t.String(),
      }),
    },
  )
  .post(
    "/:id/void",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        const result = await voidCreditMemo(params.id, body.bookId, body.date);
        emitAudit({
          type: "myfi.credit_memo.voided",
          organizationId: body.bookId,
          resource: { type: "credit_memo", id: params.id },
          data: {},
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Void failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[credit-memos] void failed:", err);
        set.status = 500;
        return { error: "Could not void the credit memo" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String(), date: t.String() }),
    },
  );

export default creditMemoRoutes;
