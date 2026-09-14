import { resolveAccessToken } from "@omnidotdev/providers";

import { AUTH_JWKS_URL } from "lib/config/env.config";

import type { Observer } from "lib/graphql/plugins/authentication.plugin";

// Re-export Observer for consumers of this module
export type { Observer } from "lib/graphql/plugins/authentication.plugin";

// Gatekeeper (better-auth) issues OPAQUE access tokens, not JWTs, so verifying
// them locally with jwtVerify always fails ("Invalid Compact JWS"). The correct
// check is the IDP userinfo endpoint: resolveAccessToken from
// @omnidotdev/providers validates opaque tokens via userinfo (and JWT-format
// tokens via JWKS), returning the user claims. The auth base URL is derived from
// the configured JWKS URL so no extra env var is required
const AUTH_BASE_URL = AUTH_JWKS_URL?.replace(/\/\.well-known\/jwks\.json$/, "");
const USERINFO_URL = AUTH_BASE_URL
  ? `${AUTH_BASE_URL}/oauth2/userinfo`
  : undefined;

let authWarned = false;

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

// Short-lived cache of resolved users keyed by access token, so a burst of API
// calls within one page load does not trigger a userinfo round-trip each time.
// TTL is short because it gates authorization; a revoked token stops working
// within the window
const USERINFO_CACHE_TTL_MS = 60_000;
const USERINFO_CACHE_MAX = 1000;
const userCache = new Map<string, { observer: Observer; expiresAt: number }>();

/**
 * Resolve an authenticated user from an access token via the IDP.
 *
 * Handles Gatekeeper's opaque access tokens (validated against the userinfo
 * endpoint) as well as JWT-format tokens (verified via JWKS), delegating to
 * @omnidotdev/providers. Results are cached briefly per token.
 *
 * @param accessToken - Raw access token (no scheme prefix).
 * @returns The resolved Observer, or null if the token is invalid.
 */
export const resolveUserFromToken = async (
  accessToken: string,
): Promise<Observer | null> => {
  if (!AUTH_BASE_URL || !USERINFO_URL) {
    if (!authWarned) {
      console.warn(
        "[Auth] AUTH_JWKS_URL is not configured; token verification is disabled",
      );
      authWarned = true;
    }

    return null;
  }

  const now = Date.now();
  const cached = userCache.get(accessToken);
  if (cached && cached.expiresAt > now) return cached.observer;

  try {
    const claims = await resolveAccessToken(accessToken, {
      authBaseUrl: AUTH_BASE_URL,
      userinfoUrl: USERINFO_URL,
    });

    if (!claims.sub) return null;

    const observer: Observer = {
      id: claims.sub as string,
      email: claims.email as string | undefined,
      name: (claims.name ?? claims.preferred_username) as string | undefined,
    };

    // Bound the cache: on overflow drop the oldest-inserted entries
    if (userCache.size >= USERINFO_CACHE_MAX) userCache.clear();
    userCache.set(accessToken, {
      observer,
      expiresAt: now + USERINFO_CACHE_TTL_MS,
    });

    return observer;
  } catch (err) {
    console.error("[Auth] Token verification failed:", (err as Error).message);

    return null;
  }
};
