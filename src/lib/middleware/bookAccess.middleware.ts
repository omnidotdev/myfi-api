import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { extractBearerToken, resolveUserFromToken } from "lib/auth";
import { dbPool } from "lib/db/db";
import { bookAccessTable } from "lib/db/schema";

type BookRole = "owner" | "editor" | "viewer";

const ROLE_HIERARCHY: Record<BookRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Check if a user has access to a book with at least the required role.
 * Returns the user's role if access is granted, null otherwise.
 */
export const checkBookAccess = async (
  userId: string,
  bookId: string,
  requiredRole: BookRole = "viewer",
): Promise<BookRole | null> => {
  const [access] = await dbPool
    .select({ role: bookAccessTable.role })
    .from(bookAccessTable)
    .where(
      and(
        eq(bookAccessTable.bookId, bookId),
        eq(bookAccessTable.userId, userId),
      ),
    );

  if (!access) return null;

  const userLevel = ROLE_HIERARCHY[access.role as BookRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel ? (access.role as BookRole) : null;
};

class BookAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookAccessError";
  }
}

/**
 * Extract bookId from the request query string or body.
 */
const extractBookId = (
  query: Record<string, string | undefined>,
  body: unknown,
): string | undefined => {
  if (query.bookId) return query.bookId;
  if (body && typeof body === "object" && "bookId" in body) {
    return (body as Record<string, string>).bookId;
  }

  return undefined;
};

/**
 * Book access authorization middleware.
 * Checks the book_access table to verify the authenticated user has
 * permission to access the requested book. Applies to any route that
 * includes a bookId in query params or request body.
 *
 * Read operations (GET) require at least viewer role.
 * Write operations (POST, PUT, PATCH, DELETE) require at least editor role.
 */
const bookAccessMiddleware = new Elysia({ name: "book-access-middleware" })
  .error({ BookAccessError })
  .onError(({ error, set }) => {
    if (error instanceof BookAccessError) {
      set.status = 403;

      return { error: "Forbidden", message: error.message };
    }
  })
  .onBeforeHandle(async ({ request, query, body }) => {
    const bookId = extractBookId(
      query as Record<string, string | undefined>,
      body,
    );

    // Skip access check if no bookId in request (e.g. listing books)
    if (!bookId) return;

    // Resolve user from the auth header (already verified by auth middleware)
    const authHeader = request.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      throw new BookAccessError("Authentication required for book access");
    }

    const user = await resolveUserFromToken(token);

    if (!user?.id) {
      throw new BookAccessError("Authentication required for book access");
    }

    const method = request.method.toUpperCase();
    const requiredRole: BookRole = method === "GET" ? "viewer" : "editor";

    const role = await checkBookAccess(user.id, bookId, requiredRole);

    if (!role) {
      throw new BookAccessError(`Insufficient permissions for book ${bookId}`);
    }
  });

export default bookAccessMiddleware;
