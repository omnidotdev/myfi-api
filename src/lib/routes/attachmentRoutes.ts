import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { attachmentTable, journalEntryTable } from "lib/db/schema";
import {
  deleteObject,
  getObject,
  isStorageConfigured,
  putObject,
} from "lib/storage/s3Client";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_ENTRY = 10;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
];

// Strip path separators and leading/trailing dots/whitespace to prevent
// path traversal in storage keys
const sanitizeFilename = (name: string): string => {
  const cleaned = name.replace(/[/\\]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
  return cleaned || "file";
};

// Attachments are financial records in a PRIVATE bucket, so every upload and
// download is proxied through the API (the S3 endpoint is cluster-internal and
// book access is enforced by the global middleware plus a per-row book check)
const attachmentRoutes = new Elysia({ prefix: "/api/attachments" })
  .get(
    "/",
    async ({ query, set }) => {
      const { bookId, journalEntryId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const rows = await dbPool
        .select()
        .from(attachmentTable)
        .where(
          journalEntryId
            ? and(
                eq(attachmentTable.bookId, bookId),
                eq(attachmentTable.journalEntryId, journalEntryId),
              )
            : eq(attachmentTable.bookId, bookId),
        );

      return { attachments: rows };
    },
    {
      query: t.Object({
        bookId: t.String(),
        journalEntryId: t.Optional(t.String()),
      }),
    },
  )
  // Upload a file directly through the API (multipart). Validates, stores the
  // bytes in the private bucket, and records the attachment in one step
  .post(
    "/",
    async ({ body, set }) => {
      if (!isStorageConfigured()) {
        set.status = 503;
        return { error: "Storage not configured" };
      }

      const { file, bookId, journalEntryId, createdBy } = body;

      if (!ALLOWED_TYPES.includes(file.type)) {
        set.status = 400;
        return { error: "Content type not allowed" };
      }

      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        set.status = 400;
        return { error: "File size must be between 1 byte and 25MB" };
      }

      if (journalEntryId) {
        const [targetEntry] = await dbPool
          .select({ bookId: journalEntryTable.bookId })
          .from(journalEntryTable)
          .where(eq(journalEntryTable.id, journalEntryId));

        if (!targetEntry || targetEntry.bookId !== bookId) {
          set.status = 400;
          return {
            error: "Cannot link attachment to entry in a different book",
          };
        }

        const existing = await dbPool
          .select({ id: attachmentTable.id })
          .from(attachmentTable)
          .where(eq(attachmentTable.journalEntryId, journalEntryId));

        if (existing.length >= MAX_ATTACHMENTS_PER_ENTRY) {
          set.status = 400;
          return {
            error: `Maximum ${MAX_ATTACHMENTS_PER_ENTRY} attachments per entry`,
          };
        }
      }

      const safeFilename = sanitizeFilename(file.name);
      const storageKey = `${bookId}/${randomUUID()}/${safeFilename}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      try {
        await putObject(storageKey, bytes, file.type);
      } catch (err) {
        console.error("[attachments] upload failed:", err);
        set.status = 500;
        return { error: "Could not store the attachment" };
      }

      const [attachment] = await dbPool
        .insert(attachmentTable)
        .values({
          bookId,
          journalEntryId: journalEntryId ?? null,
          filename: file.name,
          contentType: file.type,
          sizeBytes: bytes.byteLength,
          storageKey,
          uploadStatus: "complete",
          createdBy: createdBy ?? "unknown",
        })
        .returning();

      emitAudit({
        type: "myfi.attachment.uploaded",
        organizationId: attachment.bookId,
        resource: {
          type: "attachment",
          id: attachment.id,
          name: attachment.filename,
        },
        data: {
          bookId: attachment.bookId,
          journalEntryId: attachment.journalEntryId,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        },
      });

      set.status = 201;
      return { attachment };
    },
    {
      body: t.Object({
        file: t.File(),
        bookId: t.String(),
        journalEntryId: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
    },
  )
  // Stream the file back through the API (book access enforced; the file never
  // leaves via a shareable URL)
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
        .from(attachmentTable)
        .where(eq(attachmentTable.id, params.id));

      // Ownership guard (IDOR): the attachment must belong to the named book
      if (!row || row.bookId !== bookId) {
        set.status = 404;
        return { error: "Attachment not found" };
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
        console.error("[attachments] download failed:", err);
        set.status = 500;
        return { error: "Could not retrieve the attachment" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ bookId: t.String() }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [current] = await dbPool
        .select()
        .from(attachmentTable)
        .where(eq(attachmentTable.id, id));

      if (!current) {
        set.status = 404;
        return { error: "Attachment not found" };
      }

      const nextJournalEntryId = body.journalEntryId ?? null;

      // Validate cross-book links and per-entry cap only when assigning a
      // new non-null journal entry
      if (nextJournalEntryId && nextJournalEntryId !== current.journalEntryId) {
        const [targetEntry] = await dbPool
          .select({ bookId: journalEntryTable.bookId })
          .from(journalEntryTable)
          .where(eq(journalEntryTable.id, nextJournalEntryId));

        if (!targetEntry || targetEntry.bookId !== current.bookId) {
          set.status = 400;
          return {
            error: "Cannot link attachment to entry in a different book",
          };
        }

        const existing = await dbPool
          .select({ id: attachmentTable.id })
          .from(attachmentTable)
          .where(eq(attachmentTable.journalEntryId, nextJournalEntryId));

        if (existing.length >= MAX_ATTACHMENTS_PER_ENTRY) {
          set.status = 400;
          return {
            error: `Maximum ${MAX_ATTACHMENTS_PER_ENTRY} attachments per entry`,
          };
        }
      }

      const [attachment] = await dbPool
        .update(attachmentTable)
        .set({ journalEntryId: nextJournalEntryId })
        .where(eq(attachmentTable.id, id))
        .returning();

      return { attachment };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        journalEntryId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [attachment] = await dbPool
        .select()
        .from(attachmentTable)
        .where(eq(attachmentTable.id, id));

      if (!attachment) {
        set.status = 404;
        return { error: "Attachment not found" };
      }

      try {
        await deleteObject(attachment.storageKey);
      } catch (err) {
        console.warn(
          `[attachments] Failed to delete object ${attachment.storageKey}:`,
          err,
        );
      }

      await dbPool.delete(attachmentTable).where(eq(attachmentTable.id, id));

      emitAudit({
        type: "myfi.attachment.deleted",
        organizationId: attachment.bookId,
        resource: {
          type: "attachment",
          id: attachment.id,
          name: attachment.filename,
        },
        data: {
          bookId: attachment.bookId,
          journalEntryId: attachment.journalEntryId,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default attachmentRoutes;
