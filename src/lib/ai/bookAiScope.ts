import { and, asc, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { bookAccessTable, bookTable } from "lib/db/schema";

/** Who a book's AI key is minted under, and which workspace pays for it */
export interface BookAiScope {
  /** Identity-provider user id the managed key is provisioned for */
  keyHolderId: string;
  /** Organization (workspace) that owns the book and is billed */
  organizationId: string;
}

/**
 * Resolve the AI billing scope for a book. Books are workspace-owned, so the
 * book's organization is always the billed entity. The key is minted under the
 * acting user when there is one (an interactive request), else under the book's
 * owner (background work such as a scheduled bank sync has no actor). Returns
 * null when the book or, for background work, its owner cannot be found
 * @param bookId - Book the AI call runs for
 * @param actorId - Acting user's identity-provider id, when a request has one
 */
export const lookupBookAiScope = async (
  bookId: string,
  actorId?: string,
): Promise<BookAiScope | null> => {
  const [book] = await dbPool
    .select({ organizationId: bookTable.organizationId })
    .from(bookTable)
    .where(eq(bookTable.id, bookId));

  if (!book) return null;

  if (actorId) {
    return { keyHolderId: actorId, organizationId: book.organizationId };
  }

  const [owner] = await dbPool
    .select({ userId: bookAccessTable.userId })
    .from(bookAccessTable)
    .where(
      and(
        eq(bookAccessTable.bookId, bookId),
        eq(bookAccessTable.role, "owner"),
      ),
    )
    .orderBy(asc(bookAccessTable.createdAt))
    .limit(1);

  if (!owner) return null;

  return { keyHolderId: owner.userId, organizationId: book.organizationId };
};
