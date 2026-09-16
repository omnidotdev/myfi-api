import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import { attachmentTable, journalEntryTable } from "lib/db/schema";
import {
  deleteObject,
  generateDownloadUrl,
  generateUploadUrl,
  headObject,
  isStorageConfigured,
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

// Attachment CRUD routes for managing file uploads via presigned URLs
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

      const attachments = await Promise.all(
        rows.map(async (row) => {
          let downloadUrl: string | null = null;
          if (row.uploadStatus === "complete" && isStorageConfigured()) {
            try {
              downloadUrl = await generateDownloadUrl(row.storageKey);
            } catch {
              downloadUrl = null;
            }
          }
          return { ...row, downloadUrl };
        }),
      );

      return { attachments };
    },
    {
      query: t.Object({
        bookId: t.String(),
        journalEntryId: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/presign",
    async ({ body, set }) => {
      if (!isStorageConfigured()) {
        set.status = 503;
        return { error: "Storage not configured" };
      }

      if (!ALLOWED_TYPES.includes(body.contentType)) {
        set.status = 400;
        return { error: "Content type not allowed" };
      }

      if (body.sizeBytes <= 0 || body.sizeBytes > MAX_FILE_SIZE) {
        set.status = 400;
        return { error: "File size must be between 1 byte and 25MB" };
      }

      if (body.journalEntryId) {
        const existing = await dbPool
          .select({ id: attachmentTable.id })
          .from(attachmentTable)
          .where(
            and(
              eq(attachmentTable.journalEntryId, body.journalEntryId),
              eq(attachmentTable.uploadStatus, "complete"),
            ),
          );

        if (existing.length >= MAX_ATTACHMENTS_PER_ENTRY) {
          set.status = 400;
          return {
            error: `Maximum ${MAX_ATTACHMENTS_PER_ENTRY} attachments per entry`,
          };
        }
      }

      const safeFilename = sanitizeFilename(body.filename);
      const storageKey = `${body.bookId}/${randomUUID()}/${safeFilename}`;

      const [attachment] = await dbPool
        .insert(attachmentTable)
        .values({
          bookId: body.bookId,
          journalEntryId: body.journalEntryId ?? null,
          filename: body.filename,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
          storageKey,
          uploadStatus: "pending",
          createdBy: body.createdBy ?? "unknown",
        })
        .returning();

      const uploadUrl = await generateUploadUrl(
        storageKey,
        body.contentType,
        body.sizeBytes,
      );

      set.status = 201;

      return { attachment, uploadUrl };
    },
    {
      body: t.Object({
        bookId: t.String(),
        journalEntryId: t.Optional(t.String()),
        filename: t.String(),
        contentType: t.String(),
        sizeBytes: t.Number(),
        createdBy: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/:id/confirm",
    async ({ params, set }) => {
      const { id } = params;

      const [row] = await dbPool
        .select()
        .from(attachmentTable)
        .where(eq(attachmentTable.id, id));

      if (!row) {
        set.status = 404;
        return { error: "Attachment not found" };
      }

      if (row.uploadStatus === "complete") {
        return { attachment: row };
      }

      const head = await headObject(row.storageKey);

      if (!head.exists) {
        set.status = 400;
        return { error: "File not found in storage" };
      }

      const [attachment] = await dbPool
        .update(attachmentTable)
        .set({
          uploadStatus: "complete",
          ...(head.contentLength !== undefined
            ? { sizeBytes: head.contentLength }
            : {}),
        })
        .where(eq(attachmentTable.id, id))
        .returning();

      emitAudit({
        type: "myfi.attachment.uploaded",
        organizationId: attachment.bookId,
        actor: { id: attachment.createdBy },
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

      return { attachment };
    },
    {
      params: t.Object({ id: t.String() }),
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

        // Pending attachments do not count toward the cap, they are only
        // enforced once the upload is confirmed
        if (current.uploadStatus === "complete") {
          const existing = await dbPool
            .select({ id: attachmentTable.id })
            .from(attachmentTable)
            .where(
              and(
                eq(attachmentTable.journalEntryId, nextJournalEntryId),
                eq(attachmentTable.uploadStatus, "complete"),
              ),
            );

          if (existing.length >= MAX_ATTACHMENTS_PER_ENTRY) {
            set.status = 400;
            return {
              error: `Maximum ${MAX_ATTACHMENTS_PER_ENTRY} attachments per entry`,
            };
          }
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
        actor: { id: attachment.createdBy },
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
