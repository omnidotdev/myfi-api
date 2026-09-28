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

/**
 * Per-handler book authorization for routes the global middleware can't guard
 * (those addressed by a path id with no `bookId` in query/body, so the handler
 * must resolve the resource's `bookId` itself and call this). Self-contained:
 * resolves the caller from the bearer token so it needs nothing from context.
 * On denial it sets a 403 status and returns null; on success returns the
 * caller's user id. Usage:
 *   const auth = await authorizeBook(request, bookId, "editor", set);
 *   if (!auth) return { error: "Forbidden" };
 * @returns `{ userId }` when allowed, `null` (and a 403 status) when denied
 */
export const authorizeBook = async (
  request: Request,
  bookId: string,
  requiredRole: BookRole,
  set: { status?: number | string },
): Promise<{ userId: string } | null> => {
  const token = extractBearerToken(request.headers.get("authorization"));
  const user = token ? await resolveUserFromToken(token) : null;

  if (user?.id && (await checkBookAccess(user.id, bookId, requiredRole))) {
    return { userId: user.id };
  }

  set.status = 403;
  return null;
};

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
  // `as: "global"` is essential: without a scope the hook is `local` and never
  // runs for the route plugins mounted after this middleware on the root app, so
  // book-level authorization silently does nothing (the whole reason this was a
  // no-op). We return the 403 response directly rather than throwing, because a
  // globally-scoped hook throws in the root lifecycle where this plugin's local
  // onError does not catch it. Verified by the mounted integration test
  .onBeforeHandle({ as: "global" }, async ({ request, query, body, set }) => {
    const bookId = extractBookId(
      query as Record<string, string | undefined>,
      body,
    );

    // Skip access check if no bookId in request (e.g. listing books)
    if (!bookId) return;

    const forbidden = (message: string) => {
      set.status = 403;
      return { error: "Forbidden", message };
    };

    // Resolve user from the auth header (already verified by auth middleware)
    const authHeader = request.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token) return forbidden("Authentication required for book access");

    const user = await resolveUserFromToken(token);

    if (!user?.id) return forbidden("Authentication required for book access");

    const method = request.method.toUpperCase();
    const requiredRole: BookRole = method === "GET" ? "viewer" : "editor";

    const role = await checkBookAccess(user.id, bookId, requiredRole);

    if (!role) return forbidden(`Insufficient permissions for book ${bookId}`);
  });

export default bookAccessMiddleware;
