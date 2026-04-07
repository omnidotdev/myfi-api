import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { journalEntryTable, vendorTable } from "lib/db/schema";
import { decryptToken, encryptToken } from "lib/encryption/tokenEncryption";

// Mask an encrypted TIN for safe display
const maskTin = (
  encryptedTin: string | null,
  type: string | null,
): string | null => {
  if (!encryptedTin) return null;
  try {
    const raw = decryptToken(encryptedTin);
    const last4 = raw.slice(-4);
    if (type === "ssn") return `***-**-${last4}`;
    if (type === "ein") return `**-***${last4}`;
    return `****${last4}`;
  } catch {
    return "****";
  }
};

// Vendor CRUD routes
const vendorRoutes = new Elysia({ prefix: "/api/vendors" })
  // List vendors for a book
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const vendors = await dbPool
      .select()
      .from(vendorTable)
      .where(eq(vendorTable.bookId, bookId));

    return {
      vendors: vendors.map((v) => ({
        ...v,
        taxId: maskTin(v.taxId, v.taxIdType),
      })),
    };
  })
  // Get single vendor
  .get(
    "/:id",
    async ({ params, set }) => {
      const [vendor] = await dbPool
        .select()
        .from(vendorTable)
        .where(eq(vendorTable.id, params.id));

      if (!vendor) {
        set.status = 404;
        return { error: "Vendor not found" };
      }

      return {
        vendor: {
          ...vendor,
          taxId: maskTin(vendor.taxId, vendor.taxIdType),
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // Create vendor
  .post(
    "/",
    async ({ body, set }) => {
      const [vendor] = await dbPool
        .insert(vendorTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          businessName: body.businessName ?? null,
          taxIdType: body.taxIdType ?? null,
          taxId: body.taxId ? encryptToken(body.taxId) : null,
          address: body.address ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          zip: body.zip ?? null,
          email: body.email ?? null,
          is1099Eligible: body.is1099Eligible ?? true,
          threshold: body.threshold ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.vendor.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "vendor", id: vendor.id, name: vendor.name },
        data: { bookId: body.bookId },
      });

      return {
        vendor: {
          ...vendor,
          taxId: maskTin(vendor.taxId, vendor.taxIdType),
        },
      };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        businessName: t.Optional(t.String()),
        taxIdType: t.Optional(t.String()),
        taxId: t.Optional(t.String()),
        address: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        zip: t.Optional(t.String()),
        email: t.Optional(t.String()),
        is1099Eligible: t.Optional(t.Boolean()),
        threshold: t.Optional(t.String()),
      }),
    },
  )
  // Update vendor
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [existing] = await dbPool
        .select()
        .from(vendorTable)
        .where(eq(vendorTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Vendor not found" };
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.businessName !== undefined)
        updates.businessName = body.businessName;
      if (body.taxIdType !== undefined) updates.taxIdType = body.taxIdType;
      if (body.taxId !== undefined)
        updates.taxId = body.taxId ? encryptToken(body.taxId) : null;
      if (body.address !== undefined) updates.address = body.address;
      if (body.city !== undefined) updates.city = body.city;
      if (body.state !== undefined) updates.state = body.state;
      if (body.zip !== undefined) updates.zip = body.zip;
      if (body.email !== undefined) updates.email = body.email;
      if (body.is1099Eligible !== undefined)
        updates.is1099Eligible = body.is1099Eligible;
      if (body.threshold !== undefined) updates.threshold = body.threshold;

      const [vendor] = await dbPool
        .update(vendorTable)
        .set(updates)
        .where(eq(vendorTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.vendor.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "vendor", id: vendor.id, name: vendor.name },
        data: { bookId: existing.bookId },
      });

      return {
        vendor: {
          ...vendor,
          taxId: maskTin(vendor.taxId, vendor.taxIdType),
        },
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        businessName: t.Optional(t.String()),
        taxIdType: t.Optional(t.String()),
        taxId: t.Optional(t.String()),
        address: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        zip: t.Optional(t.String()),
        email: t.Optional(t.String()),
        is1099Eligible: t.Optional(t.Boolean()),
        threshold: t.Optional(t.String()),
      }),
    },
  )
  // Delete vendor
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [existing] = await dbPool
        .select()
        .from(vendorTable)
        .where(eq(vendorTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Vendor not found" };
      }

      // Check for linked journal entries
      const linkedEntries = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(eq(journalEntryTable.vendorId, params.id))
        .limit(1);

      if (linkedEntries.length > 0) {
        set.status = 409;
        return {
          error: "Cannot delete vendor with linked journal entries",
        };
      }

      await dbPool.delete(vendorTable).where(eq(vendorTable.id, params.id));

      emitAudit({
        type: "myfi.vendor.deleted",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "vendor", id: existing.id, name: existing.name },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default vendorRoutes;
