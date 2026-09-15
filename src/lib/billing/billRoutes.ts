import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { billLineTable, billTable, vendorTable } from "lib/db/schema";
import { createBillDraft } from "./createBillDraft";
import { postBill } from "./postBill";
import { recordBillPayment } from "./recordBillPayment";
import { voidBill } from "./voidBill";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isClientError = (message: string): boolean =>
  /not found|no lines|at least one line|Accounts Payable|balance|positive|posted, unpaid|payments|Payment account/i.test(
    message,
  );

/**
 * Vendor bill (accounts payable) actions that post to the ledger, mirroring the
 * invoice routes. Reads are book-scoped and ownership-guarded; book access is
 * enforced by the global bookAccessMiddleware
 */
const billRoutes = new Elysia({ prefix: "/api/bills" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rows = await dbPool
      .select({
        id: billTable.id,
        number: billTable.number,
        status: billTable.status,
        billDate: billTable.billDate,
        dueDate: billTable.dueDate,
        total: billTable.total,
        amountPaid: billTable.amountPaid,
        vendorId: billTable.vendorId,
        vendorName: vendorTable.name,
      })
      .from(billTable)
      .innerJoin(vendorTable, eq(billTable.vendorId, vendorTable.id))
      .where(eq(billTable.bookId, bookId))
      .orderBy(desc(billTable.billDate));

    return {
      bills: rows.map((r) => ({
        ...r,
        balanceDue: (Number(r.total) - Number(r.amountPaid)).toFixed(4),
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

      const [bill] = await dbPool
        .select()
        .from(billTable)
        .where(eq(billTable.id, params.id));
      if (!bill || bill.bookId !== bookId) {
        set.status = 404;
        return { error: "Bill not found" };
      }

      const lines = await dbPool
        .select()
        .from(billLineTable)
        .where(eq(billLineTable.billId, params.id))
        .orderBy(billLineTable.sortOrder);

      return { bill, lines };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createBillDraft(body);
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[bills] create failed:", err);
        set.status = 500;
        return { error: "Could not create the bill" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        vendorId: t.String(),
        number: t.String(),
        billDate: t.String(),
        dueDate: t.String(),
        memo: t.Optional(t.String()),
        lines: t.Array(
          t.Object({
            description: t.String(),
            quantity: t.Number(),
            unitPrice: t.Number(),
            expenseAccountId: t.String(),
            taxJurisdictionId: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .post(
    "/:id/post",
    async ({ params, body, set }) => {
      try {
        return await postBill(params.id, body.bookId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Post failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[bills] post failed:", err);
        set.status = 500;
        return { error: "Could not post the bill" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  )
  .post(
    "/:id/payments",
    async ({ params, body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        return await recordBillPayment({
          billId: params.id,
          bookId: body.bookId,
          amount: body.amount,
          paymentAccountId: body.paymentAccountId,
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
        console.error("[bills] payment failed:", err);
        set.status = 500;
        return { error: "Could not record the payment" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        amount: t.Number(),
        paymentAccountId: t.String(),
        date: t.String(),
        method: t.Optional(t.String()),
        reference: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:id/void",
    async ({ params, body, set }) => {
      try {
        return await voidBill(params.id, body.bookId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Void failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[bills] void failed:", err);
        set.status = 500;
        return { error: "Could not void the bill" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  );

export default billRoutes;
