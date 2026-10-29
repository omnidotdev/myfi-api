import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  bankDepositTable,
  invoicePaymentTable,
  invoiceTable,
} from "lib/db/schema";
import { createBankDeposit } from "./createBankDeposit";
import { voidBankDeposit } from "./voidBankDeposit";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isClientError = (message: string): boolean =>
  /not found|at least one payment|not available to deposit|already void/i.test(
    message,
  );

/**
 * Bank deposits: list receipts sitting in Undeposited Funds, group them into a
 * deposit, list deposits, and void one. Book access (viewer for reads, editor
 * for writes) is enforced by the global bookAccessMiddleware via the bookId in
 * the query or body
 */
const bankDepositRoutes = new Elysia({ prefix: "/api/bank-deposits" })
  // Payments held in Undeposited Funds, waiting to be deposited
  .get("/undeposited", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const [uf] = await dbPool
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.bookId, bookId),
          eq(accountTable.subType, "undeposited_funds"),
        ),
      )
      .limit(1);
    if (!uf) {
      return { account: null, payments: [] };
    }
    const payments = await dbPool
      .select({
        id: invoicePaymentTable.id,
        amount: invoicePaymentTable.amount,
        date: invoicePaymentTable.date,
        method: invoicePaymentTable.method,
        reference: invoicePaymentTable.reference,
        invoiceNumber: invoiceTable.number,
      })
      .from(invoicePaymentTable)
      .leftJoin(
        invoiceTable,
        eq(invoicePaymentTable.invoiceId, invoiceTable.id),
      )
      .where(
        and(
          eq(invoicePaymentTable.bookId, bookId),
          eq(invoicePaymentTable.depositAccountId, uf.id),
          isNull(invoicePaymentTable.bankDepositId),
        ),
      )
      .orderBy(desc(invoicePaymentTable.date));
    return { account: { id: uf.id }, payments };
  })
  // Recorded deposits for the book
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const deposits = await dbPool
      .select()
      .from(bankDepositTable)
      .where(eq(bankDepositTable.bookId, bookId))
      .orderBy(desc(bankDepositTable.date));
    return { deposits };
  })
  .post(
    "/",
    async ({ body, set }) => {
      if (!ISO_DATE.test(body.date)) {
        set.status = 400;
        return { error: "date must be a YYYY-MM-DD date" };
      }
      try {
        return await createBankDeposit({
          bookId: body.bookId,
          date: body.date,
          bankAccountId: body.bankAccountId,
          paymentIds: body.paymentIds,
          memo: body.memo,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Deposit failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[bank-deposit] create failed:", err);
        set.status = 500;
        return { error: "Could not record the deposit" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        date: t.String(),
        bankAccountId: t.String(),
        paymentIds: t.Array(t.String()),
        memo: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:id/void",
    async ({ params, body, set }) => {
      try {
        return await voidBankDeposit(params.id, body.bookId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Void failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[bank-deposit] void failed:", err);
        set.status = 500;
        return { error: "Could not void the deposit" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ bookId: t.String() }),
    },
  );

export default bankDepositRoutes;
