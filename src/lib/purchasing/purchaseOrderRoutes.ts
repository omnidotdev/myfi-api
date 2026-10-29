import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  purchaseOrderLineTable,
  purchaseOrderTable,
  vendorTable,
} from "lib/db/schema";
import { convertPurchaseOrderToBill } from "./convertPurchaseOrderToBill";
import { createPurchaseOrderDraft } from "./createPurchaseOrderDraft";
import { updatePurchaseOrderStatus } from "./updatePurchaseOrderStatus";

import type { SettablePurchaseOrderStatus } from "./updatePurchaseOrderStatus";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isClientError = (message: string): boolean =>
  /not found|at least one line|no lines|void|converted|Invalid/i.test(message);

/**
 * Purchase order routes, the purchasing mirror of the estimate routes. Reads are
 * book-scoped and ownership-guarded; book access is enforced by the global
 * bookAccessMiddleware. Purchase orders do not post to the ledger; converting one
 * produces a draft bill that does
 */
const purchaseOrderRoutes = new Elysia({ prefix: "/api/purchase-orders" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rows = await dbPool
      .select({
        id: purchaseOrderTable.id,
        number: purchaseOrderTable.number,
        status: purchaseOrderTable.status,
        date: purchaseOrderTable.date,
        total: purchaseOrderTable.total,
        vendorId: purchaseOrderTable.vendorId,
        vendorName: vendorTable.name,
        convertedBillId: purchaseOrderTable.convertedBillId,
      })
      .from(purchaseOrderTable)
      .innerJoin(vendorTable, eq(purchaseOrderTable.vendorId, vendorTable.id))
      .where(eq(purchaseOrderTable.bookId, bookId))
      .orderBy(desc(purchaseOrderTable.date));

    return { purchaseOrders: rows };
  })
  .get(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const [purchaseOrder] = await dbPool
        .select()
        .from(purchaseOrderTable)
        .where(eq(purchaseOrderTable.id, params.id));
      if (!purchaseOrder || purchaseOrder.bookId !== bookId) {
        set.status = 404;
        return { error: "Purchase order not found" };
      }

      const lines = await dbPool
        .select()
        .from(purchaseOrderLineTable)
        .where(eq(purchaseOrderLineTable.purchaseOrderId, params.id))
        .orderBy(purchaseOrderLineTable.sortOrder);

      return { purchaseOrder, lines };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const result = await createPurchaseOrderDraft(body);
        emitAudit({
          type: "myfi.purchase_order.created",
          organizationId: body.bookId,
          resource: { type: "purchase_order", id: result.purchaseOrderId },
          data: { number: result.number, subtotal: result.subtotal },
        });
        set.status = 201;
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        if (isClientError(message)) {
          set.status = 400;
          return { error: message };
        }
        console.error("[purchase-orders] create failed:", err);
        set.status = 500;
        return { error: "Could not create the purchase order" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        vendorId: t.String(),
        number: t.String(),
        date: t.String(),
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
    "/:id/status",
    async ({ params, body, set }) => {
      try {
        const result = await updatePurchaseOrderStatus(
          params.id,
          body.bookId,
          body.status as SettablePurchaseOrderStatus,
        );
        emitAudit({
          type: "myfi.purchase_order.status_changed",
          organizationId: body.bookId,
          resource: { type: "purchase_order", id: params.id },
          data: { status: result.status },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[purchase-orders] status update failed:", err);
        set.status = 500;
        return { error: "Could not update the purchase order" };
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
      if (!ISO_DATE.test(body.billDate) || !ISO_DATE.test(body.dueDate)) {
        set.status = 400;
        return { error: "billDate and dueDate must be YYYY-MM-DD dates" };
      }
      try {
        const result = await convertPurchaseOrderToBill({
          purchaseOrderId: params.id,
          bookId: body.bookId,
          billNumber: body.billNumber,
          billDate: body.billDate,
          dueDate: body.dueDate,
        });
        emitAudit({
          type: "myfi.purchase_order.converted",
          organizationId: body.bookId,
          resource: { type: "purchase_order", id: params.id },
          data: {
            billId: result.billId,
            alreadyConverted: result.alreadyConverted,
          },
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Convert failed";
        if (isClientError(message)) {
          set.status = /not found/i.test(message) ? 404 : 400;
          return { error: message };
        }
        console.error("[purchase-orders] convert failed:", err);
        set.status = 500;
        return { error: "Could not convert the purchase order" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        bookId: t.String(),
        billNumber: t.String(),
        billDate: t.String(),
        dueDate: t.String(),
      }),
    },
  );

export default purchaseOrderRoutes;
