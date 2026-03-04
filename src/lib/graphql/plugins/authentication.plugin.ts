import { useGenericAuth } from "@envelop/generic-auth";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { AUTH_JWKS_URL } from "lib/config/env.config";

import type { ResolveUserFn } from "@envelop/generic-auth";
import type { GraphQLContext } from "lib/graphql/createGraphqlContext";

/**
 * Observer type - represents the authenticated entity.
 */
export interface Observer {
  id: string;
  email?: string;
  name?: string;
}

const jwks = AUTH_JWKS_URL ? createRemoteJWKSet(new URL(AUTH_JWKS_URL)) : null;

/**
 * Validate user session via JWKS token verification.
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth#getting-started
 */
const resolveUser: ResolveUserFn<Observer, GraphQLContext> = async (ctx) => {
  const accessToken = ctx.request.headers
    .get("authorization")
    ?.split("Bearer ")[1];

  if (!accessToken || !jwks) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(accessToken, jwks);

    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };
  } catch {
    return null;
  }
};

/**
 * Authentication plugin.
 * Uses "resolve-only" mode to allow unauthenticated queries.
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth
 */
const authenticationPlugin = useGenericAuth({
  contextFieldName: "observer",
  resolveUserFn: resolveUser,
  mode: "resolve-only",
});

export default authenticationPlugin;
