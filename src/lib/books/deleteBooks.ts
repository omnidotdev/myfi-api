import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  attachmentTable,
  bookTable,
  connectedAccountTable,
  documentTable,
  payrollConnectionTable,
} from "lib/db/schema";
import { revokeGustoToken } from "lib/payroll/revokeGustoToken";
import { revokePlaidItem } from "lib/plaid/revokePlaidItem";
import { deleteObject, isStorageConfigured } from "lib/storage/s3Client";

/** What tearing down a book reaches outside the database (injectable for tests) */
export interface DeleteBooksDeps {
  db?: typeof dbPool;
  revokePlaid?: (encryptedAccessToken: string) => Promise<boolean>;
  revokeGusto?: (encryptedAccessToken: string) => Promise<boolean>;
  deleteStoredObject?: (key: string) => Promise<void>;
  storageConfigured?: () => boolean;
}

interface DeleteBooksResult {
  deletedBookIds: string[];
  /** Bank (Plaid) items asked to be removed */
  plaidItems: number;
  /** Payroll (Gusto) tokens asked to be revoked */
  payrollTokens: number;
  /** Stored attachment and document files deleted */
  files: number;
}

/**
 * Permanently delete books with everything they hold. Before the rows go:
 *
 * - every bank connection's Plaid item is removed, so it stops reaching the
 *   institution (and billing); a Plaid item shared by several accounts is
 *   removed once
 * - every payroll connection's Gusto token is revoked
 * - every stored attachment and document file is deleted from object storage
 *
 * Provider revocation is best effort, the same as disconnecting by hand: a
 * provider that cannot be reached never blocks the deletion. A file that cannot
 * be deleted throws before any row is gone, so a retry still finds its key.
 * The books are then deleted in one statement, cascading to all of their data
 */
export const deleteBooks = async (
  bookIds: readonly string[],
  {
    db = dbPool,
    revokePlaid = revokePlaidItem,
    revokeGusto = revokeGustoToken,
    deleteStoredObject = deleteObject,
    storageConfigured = isStorageConfigured,
  }: DeleteBooksDeps = {},
): Promise<DeleteBooksResult> => {
  const ids = [...new Set(bookIds)];
  if (ids.length === 0)
    return { deletedBookIds: [], plaidItems: 0, payrollTokens: 0, files: 0 };

  const [banks, payroll, attachments, documents] = await Promise.all([
    db
      .select({ accessToken: connectedAccountTable.accessToken })
      .from(connectedAccountTable)
      .where(
        and(
          inArray(connectedAccountTable.bookId, ids),
          eq(connectedAccountTable.provider, "plaid"),
          isNotNull(connectedAccountTable.accessToken),
        ),
      ),
    db
      .select({ accessToken: payrollConnectionTable.accessToken })
      .from(payrollConnectionTable)
      .where(
        and(
          inArray(payrollConnectionTable.bookId, ids),
          isNotNull(payrollConnectionTable.accessToken),
        ),
      ),
    db
      .select({ key: attachmentTable.storageKey })
      .from(attachmentTable)
      .where(inArray(attachmentTable.bookId, ids)),
    db
      .select({ key: documentTable.storageKey })
      .from(documentTable)
      .where(inArray(documentTable.bookId, ids)),
  ]);

  const plaidTokens = [
    ...new Set(banks.flatMap((b) => (b.accessToken ? [b.accessToken] : []))),
  ];
  for (const token of plaidTokens) await revokePlaid(token);

  const payrollTokens = [
    ...new Set(payroll.flatMap((p) => (p.accessToken ? [p.accessToken] : []))),
  ];
  for (const token of payrollTokens) await revokeGusto(token);

  const keys = [
    ...new Set([...attachments, ...documents].map((file) => file.key)),
  ];
  if (keys.length > 0 && storageConfigured()) {
    for (const key of keys) await deleteStoredObject(key);
  }

  const deleted = await db
    .delete(bookTable)
    .where(inArray(bookTable.id, ids))
    .returning({ id: bookTable.id });

  return {
    deletedBookIds: deleted.map((b) => b.id),
    plaidItems: plaidTokens.length,
    payrollTokens: payrollTokens.length,
    files: storageConfigured() ? keys.length : 0,
  };
};

/**
 * Delete every book a deleted workspace (Gatekeeper organization) holds, with
 * everything in them (see {@link deleteBooks}). Idempotent: a workspace with no
 * books left is a no-op
 */
export const deleteOrganizationBooks = async (
  organizationId: string,
  deps: DeleteBooksDeps = {},
): Promise<DeleteBooksResult> => {
  const db = deps.db ?? dbPool;
  const books = await db
    .select({ id: bookTable.id })
    .from(bookTable)
    .where(eq(bookTable.organizationId, organizationId));

  return deleteBooks(
    books.map((b) => b.id),
    deps,
  );
};
