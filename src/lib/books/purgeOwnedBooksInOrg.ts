import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { bookAccessTable, bookTable } from "lib/db/schema";

interface PurgeResult {
  /** Books that were deleted (caller is their owner) */
  deletedBookIds: string[];
  /** Books in the org left untouched because the caller is not their owner */
  skippedBookIds: string[];
}

/**
 * Delete every book the caller owns within an organization, cascading all of
 * each book's data. Books the caller does not own (viewer/editor, or someone
 * else's) are left untouched, so this can only ever remove data the caller
 * already controls. The caller's organization membership and an explicit
 * confirmation are enforced by the route; this function performs the scoped
 * deletion itself
 */
export const purgeOwnedBooksInOrg = async (
  userId: string,
  organizationId: string,
): Promise<PurgeResult> => {
  const books = await dbPool
    .select({ id: bookTable.id })
    .from(bookTable)
    .where(eq(bookTable.organizationId, organizationId));

  const deletedBookIds: string[] = [];
  const skippedBookIds: string[] = [];

  for (const book of books) {
    const [access] = await dbPool
      .select({ role: bookAccessTable.role })
      .from(bookAccessTable)
      .where(
        and(
          eq(bookAccessTable.userId, userId),
          eq(bookAccessTable.bookId, book.id),
        ),
      );

    if (access?.role === "owner") {
      await dbPool.delete(bookTable).where(eq(bookTable.id, book.id));
      deletedBookIds.push(book.id);
    } else {
      skippedBookIds.push(book.id);
    }
  }

  return { deletedBookIds, skippedBookIds };
};
