import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  vendorCreditLineTable,
  vendorCreditTable,
  vendorTable,
} from "lib/db/schema";
import { applyVendorCredit } from "./applyVendorCredit";
import { createVendorCreditDraft } from "./createVendorCreditDraft";
import { postVendorCredit } from "./postVendorCredit";
import { voidVendorCredit } from "./voidVendorCredit";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Business-rule failures safe to surface; anything else is returned generically
const isClientError = (message: string): boolean =>
  /not found|at least one line|balance|positive|Accounts Payable|different vendors|applied|closed period|open or partially|posted vendor credit/i.test(
    message,
  );

/**
 * Vendor-credit actions that post to the ledger, the accounts-payable mirror of
 * the credit-memo routes. Reads are served by PostGraphile; these routes cover
 * the side-effecting transitions. Book access is enforced by the global
 * bookAccessMiddleware from the bookId in the body or query, and each action
 * re-checks that the credit belongs to that book (IDOR guard) inside the service
 */
const vendorCreditRoutes = new Elysia({ prefix: "/api/vendor-credits" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const rows = await dbPool
      .select({
        id: vendorCreditTable.id,
        number: vendorCreditTable.number,
        status: vendorCreditTable.status,
        date: vendorCreditTable.date,
        total: vendorCreditTable.total,
        amountApplied: vendorCreditTable.amountApplied,
        vendorId: vendorCreditTable.vendorId,
        vendorName: vendorTable.name,
      })
      .from(vendorCreditTable)
      .innerJoin(vendorTable, eq(vendorCreditTable.vendorId, vendorTable.id))
      .where(eq(vendorCreditTable.bookId, bookId))
      .orderBy(desc(vendorCreditTable.date));
    return {
      vendorCredits: rows.map((r) => ({
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
      const [vendorCredit] = await dbPool
        .select()
        .from(vendorCreditTable)
        .where(eq(vendorCreditTable.id, params.id));
      if (!vendorCredit || vendorCredit.bookId !== bookId) {
        set.status = 404;
        return { error: "Vendor credit not found" };
      }
      const lines = await dbPool
        .select()
        .from(vendorCreditLineTable)
        .where(eq(vendorCreditLineTable.vendorCreditId, params.id))
        .orderBy(vendorCreditLineTable.sortOrder);
      return { vendorCredit, lines };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createVendorCreditDraft(body);
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[vendor-credits] create failed:", err);
        set.status = 500;
        return { error: "Could not create the vendor credit" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        vendorId: t.String(),
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
            expenseAccountId: t.String(),
            taxJurisdictionId: t.Optional(t.String()),
            discountPercent: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
          }),
        ),
      }),
    },
  )
  .post(
    "/:id/post",
    async ({ params, body, set }) => {
      try {
        const result = await postVendorCredit(params.id, body.bookId);
        emitAudit({
          type: "myfi.vendor_credit.posted",
          organizationId: body.bookId,
          resource: { type: "vendor_credit", id: params.id },
          data: { total: result.total },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Post failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[vendor-credits] post failed:", err);
        set.status = 500;
        return { error: "Could not post the vendor credit" };
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
        const result = await applyVendorCredit({
          vendorCreditId: params.id,
          billId: body.billId,
          bookId: body.bookId,
          amount: body.amount,
          date: body.date,
        });
        emitAudit({
          type: "myfi.vendor_credit.applied",
          organizationId: body.bookId,
          resource: { type: "vendor_credit", id: params.id },
          data: { billId: body.billId, amount: body.amount },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Apply failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[vendor-credits] apply failed:", err);
        set.status = 500;
        return { error: "Could not apply the vendor credit" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        billId: t.String(),
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
        const result = await voidVendorCredit(
          params.id,
          body.bookId,
          body.date,
        );
        emitAudit({
          type: "myfi.vendor_credit.voided",
          organizationId: body.bookId,
          resource: { type: "vendor_credit", id: params.id },
          data: {},
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Void failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[vendor-credits] void failed:", err);
        set.status = 500;
        return { error: "Could not void the vendor credit" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String(), date: t.String() }),
    },
  );

export default vendorCreditRoutes;
