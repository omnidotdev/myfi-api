import { createRemoteJWKSet, jwtVerify } from "jose";

import { AUTH_JWKS_URL } from "lib/config/env.config";

import type { JWTVerifyGetKey } from "jose";
import type { Observer } from "lib/graphql/plugins/authentication.plugin";

// Re-export Observer for consumers of this module
export type { Observer } from "lib/graphql/plugins/authentication.plugin";

let jwksCache: JWTVerifyGetKey | null = null;
let jwksWarned = false;

/**
 * Get the JWKS key set, caching it for reuse.
 */
const getJwks = (): JWTVerifyGetKey | null => {
  if (!AUTH_JWKS_URL) {
    if (!jwksWarned) {
      console.warn(
        "[Auth] AUTH_JWKS_URL is not configured; token verification is disabled",
      );
      jwksWarned = true;
    }

    return null;
  }

  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(AUTH_JWKS_URL));
  }

  return jwksCache;
};

/**
 * Extract a Bearer token from an Authorization header.
 * @param authHeader - Raw Authorization header value.
 * @returns The token string, or null if missing/malformed.
 */
export const extractBearerToken = (
  authHeader: string | null,
): string | null => {
  if (!authHeader?.startsWith("Bearer ")) return null;

  return authHeader.slice(7);
};

/**
 * Resolve an authenticated user from a JWT access token via JWKS verification.
 * @param accessToken - JWT access token.
 * @returns The resolved Observer, or null if verification fails.
 */
export const resolveUserFromToken = async (
  accessToken: string,
): Promise<Observer | null> => {
  const jwks = getJwks();
  if (!jwks) return null;

  try {
    const { payload } = await jwtVerify(accessToken, jwks);

    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };
  } catch (err) {
    console.error("[Auth] Token verification failed:", (err as Error).message);

    return null;
  }
};
