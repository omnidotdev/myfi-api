import { useGenericAuth } from "@envelop/generic-auth";

import { extractBearerToken, resolveUserFromToken } from "lib/auth";

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

/**
 * Validate the request's access token via the IDP (userinfo for Gatekeeper's
 * opaque tokens, JWKS for JWT-format tokens). Shares the exact resolution the
 * REST middlewares use, so GraphQL and REST authenticate identically.
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth#getting-started
 */
const resolveUser: ResolveUserFn<Observer, GraphQLContext> = async (ctx) => {
  const accessToken = extractBearerToken(
    ctx.request.headers.get("authorization"),
  );

  if (!accessToken) return null;

  return resolveUserFromToken(accessToken);
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
