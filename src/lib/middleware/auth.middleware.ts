import { Elysia } from "elysia";

import { extractBearerToken, resolveUserFromToken } from "lib/auth";

import type { Observer } from "lib/auth";

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * REST authentication middleware.
 * Extracts a Bearer token, verifies it via JWKS, and derives the user.
 */
const authMiddleware = new Elysia({ name: "auth-middleware" })
  .error({ AuthenticationError })
  .onError(({ error, set }) => {
    if (error instanceof AuthenticationError) {
      set.status = 401;

      return { error: "Unauthorized", message: error.message };
    }
  })
  .derive(
    { as: "scoped" },
    async ({ request }): Promise<{ user: Observer }> => {
      const authHeader = request.headers.get("authorization");
      const token = extractBearerToken(authHeader);

      if (!token) {
        throw new AuthenticationError(
          "Missing or invalid authorization header",
        );
      }

      const user = await resolveUserFromToken(token);

      if (!user) {
        throw new AuthenticationError("Invalid or expired token");
      }

      return { user };
    },
  );

export default authMiddleware;
