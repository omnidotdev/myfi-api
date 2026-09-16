import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { documentTable, vendorTable } from "lib/db/schema";
import {
  deleteObject,
  getObject,
  isStorageConfigured,
  putObject,
} from "lib/storage/s3Client";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
];
const CATEGORIES = [
  "articles",
  "ein",
  "bylaws",
  "tax_return",
  "w9",
  "statement",
  "receipt",
  "other",
];

// Strip path separators and leading/trailing dots/whitespace to prevent
// path traversal in storage keys
const sanitizeFilename = (name: string): string => {
  const cleaned = name.replace(/[/\\]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
  return cleaned || "file";
};

/**
 * Book-level document vault. Files (entity records, tax returns, W9s) live in
 * the private bucket, so every upload and download is proxied through the API
 * with book access enforced by the global middleware plus a per-row book check
 */
const documentRoutes = new Elysia({ prefix: "/api/documents" })
  .get(
    "/",
    async ({ query, set }) => {
      const { bookId, category, vendorId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const conditions = [eq(documentTable.bookId, bookId)];
      if (category) conditions.push(eq(documentTable.category, category));
      if (vendorId) conditions.push(eq(documentTable.vendorId, vendorId));

      const documents = await dbPool
        .select()
        .from(documentTable)
        .where(and(...conditions))
        .orderBy(desc(documentTable.createdAt));

      return { documents };
    },
    {
      query: t.Object({
        bookId: t.String(),
        category: t.Optional(t.String()),
        vendorId: t.Optional(t.String()),
      }),
    },
  )
  // Upload a document through the API (multipart), storing it in the private
  // bucket and recording its metadata in one step
  .post(
    "/",
    async ({ body, set }) => {
      if (!isStorageConfigured()) {
        set.status = 503;
        return { error: "Storage not configured" };
      }

      const { file, bookId, category, name, vendorId, year, notes, createdBy } =
        body;

      if (!ALLOWED_TYPES.includes(file.type)) {
        set.status = 400;
        return { error: "Content type not allowed" };
      }

      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        set.status = 400;
        return { error: "File size must be between 1 byte and 50MB" };
      }

      const resolvedCategory = category ?? "other";
      if (!CATEGORIES.includes(resolvedCategory)) {
        set.status = 400;
        return { error: "Unknown category" };
      }

      // A vendor link must belong to the same book (IDOR + cross-book guard)
      if (vendorId) {
        const [vendor] = await dbPool
          .select({ bookId: vendorTable.bookId })
          .from(vendorTable)
          .where(eq(vendorTable.id, vendorId));

        if (!vendor || vendor.bookId !== bookId) {
          set.status = 400;
          return { error: "Vendor not found in this book" };
        }
      }

      const safeFilename = sanitizeFilename(file.name);
      const storageKey = `documents/${bookId}/${randomUUID()}/${safeFilename}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      try {
        await putObject(storageKey, bytes, file.type);
      } catch (err) {
        console.error("[documents] upload failed:", err);
        set.status = 500;
        return { error: "Could not store the document" };
      }

      const [document] = await dbPool
        .insert(documentTable)
        .values({
          bookId,
          category: resolvedCategory,
          name: name ?? file.name,
          filename: file.name,
          contentType: file.type,
          sizeBytes: bytes.byteLength,
          storageKey,
          vendorId: vendorId ?? null,
          year: year ? Number.parseInt(year, 10) : null,
          notes: notes ?? null,
          createdBy: createdBy ?? "unknown",
        })
        .returning();

      emitAudit({
        type: "myfi.document.uploaded",
        organizationId: document.bookId,
        resource: {
          type: "document",
          id: document.id,
          name: document.name,
        },
        data: {
          bookId: document.bookId,
          category: document.category,
          vendorId: document.vendorId,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
        },
      });

      set.status = 201;
      return { document };
    },
    {
      body: t.Object({
        file: t.File(),
        bookId: t.String(),
        category: t.Optional(t.String()),
        name: t.Optional(t.String()),
        vendorId: t.Optional(t.String()),
        year: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
    },
  )
  // Stream the file back through the API (book access enforced; no shareable URL)
  .get(
    "/:id/download",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      if (!isStorageConfigured()) {
        set.status = 503;
        return { error: "Storage not configured" };
      }

      const [row] = await dbPool
        .select()
        .from(documentTable)
        .where(eq(documentTable.id, params.id));

      // Ownership guard (IDOR): the document must belong to the named book
      if (!row || row.bookId !== bookId) {
        set.status = 404;
        return { error: "Document not found" };
      }

      try {
        const { body, contentType, contentLength } = await getObject(
          row.storageKey,
        );
        return new Response(body, {
          headers: {
            "Content-Type": contentType ?? row.contentType,
            "Content-Disposition": `inline; filename="${sanitizeFilename(row.filename)}"`,
            "Content-Length": String(contentLength ?? row.sizeBytes),
          },
        });
      } catch (err) {
        console.error("[documents] download failed:", err);
        set.status = 500;
        return { error: "Could not retrieve the document" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ bookId: t.String() }),
    },
  )
  .delete(
    "/:id",
    async ({ params, query, set }) => {
      const { bookId } = query;
      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const [document] = await dbPool
        .select()
        .from(documentTable)
        .where(eq(documentTable.id, params.id));

      if (!document || document.bookId !== bookId) {
        set.status = 404;
        return { error: "Document not found" };
      }

      try {
        await deleteObject(document.storageKey);
      } catch (err) {
        console.warn(
          `[documents] Failed to delete object ${document.storageKey}:`,
          err,
        );
      }

      await dbPool.delete(documentTable).where(eq(documentTable.id, params.id));

      emitAudit({
        type: "myfi.document.deleted",
        organizationId: document.bookId,
        resource: {
          type: "document",
          id: document.id,
          name: document.name,
        },
        data: { bookId: document.bookId, category: document.category },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ bookId: t.String() }),
    },
  );

export default documentRoutes;
