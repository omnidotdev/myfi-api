import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { customerTable, invoiceTable } from "lib/db/schema";

// Customer CRUD routes. Book access is enforced by the global
// bookAccessMiddleware from the bookId in the query or body
const customerRoutes = new Elysia({ prefix: "/api/customers" })
  // List customers for a book
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const customers = await dbPool
      .select()
      .from(customerTable)
      .where(eq(customerTable.bookId, bookId));

    return { customers };
  })
  // Get a single customer
  .get(
    "/:id",
    async ({ params, set }) => {
      const [customer] = await dbPool
        .select()
        .from(customerTable)
        .where(eq(customerTable.id, params.id));

      if (!customer) {
        set.status = 404;
        return { error: "Customer not found" };
      }

      return { customer };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Create a customer
  .post(
    "/",
    async ({ body, set }) => {
      const [customer] = await dbPool
        .insert(customerTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          businessName: body.businessName ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          zip: body.zip ?? null,
          notes: body.notes ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.customer.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "customer", id: customer.id, name: customer.name },
        data: { bookId: body.bookId },
      });

      return { customer };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        businessName: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        address: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        zip: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )
  // Update a customer
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(customerTable)
        .where(eq(customerTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Customer not found" };
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      for (const key of [
        "name",
        "businessName",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip",
        "notes",
        "isActive",
      ] as const) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      const [customer] = await dbPool
        .update(customerTable)
        .set(updates)
        .where(eq(customerTable.id, params.id))
        .returning();

      return { customer };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        businessName: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        address: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        zip: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  // Delete a customer (refused when invoices reference it)
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(customerTable)
        .where(eq(customerTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Customer not found" };
      }

      const linked = await dbPool
        .select({ id: invoiceTable.id })
        .from(invoiceTable)
        .where(eq(invoiceTable.customerId, params.id))
        .limit(1);
      if (linked.length > 0) {
        set.status = 409;
        return { error: "Cannot delete a customer with invoices" };
      }

      await dbPool.delete(customerTable).where(eq(customerTable.id, params.id));

      emitAudit({
        type: "myfi.customer.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "customer", id: existing.id, name: existing.name },
      });

      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export default customerRoutes;
