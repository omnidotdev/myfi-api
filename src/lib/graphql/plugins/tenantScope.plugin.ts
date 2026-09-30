import { GraphQLError } from "graphql";

import { extractBearerToken, resolveUserOrgIds } from "lib/auth";
import { extractScopeRequirements } from "lib/graphql/tenantScope";
import { checkBookAccess } from "lib/middleware/bookAccess.middleware";

import type { DocumentNode } from "graphql";
import type { GraphQLContext } from "lib/graphql/createGraphqlContext";

interface OnExecutePayload {
  args: {
    document: DocumentNode;
    operationName?: string | null;
    variableValues?: Record<string, unknown> | null;
    contextValue: unknown;
  };
  setResultAndStopExecution: (result: { errors: GraphQLError[] }) => void;
}

const forbidden = (payload: OnExecutePayload, message: string) =>
  payload.setResultAndStopExecution({ errors: [new GraphQLError(message)] });

/**
 * Per-book tenant scoping for GraphQL. The Postgraphile schema is generated from
 * the tables with no per-book filtering, so an authenticated user could read any
 * workspace's rows. Before executing, this restricts queries to the root fields
 * the app uses and verifies the caller has access to every book/organization the
 * query is scoped to (resolving the id from a variable or an inline literal).
 * Runs at execution time, so it needs no schema regeneration and cannot break
 * server boot
 */
const tenantScopePlugin = {
  async onExecute(payload: OnExecutePayload) {
    const { args } = payload;
    const context = args.contextValue as GraphQLContext;
    const userId = context.observer?.id;

    if (!userId) return forbidden(payload, "Unauthorized");

    const req = extractScopeRequirements(
      args.document,
      args.operationName ?? null,
      args.variableValues ?? {},
    );

    if ("error" in req) return forbidden(payload, req.error);

    for (const bookId of req.bookIds) {
      const role = await checkBookAccess(userId, bookId, "viewer");
      if (!role) return forbidden(payload, "Forbidden");
    }

    if (req.organizationIds.length > 0) {
      const token = extractBearerToken(
        context.request.headers.get("authorization"),
      );
      const orgIds = token ? await resolveUserOrgIds(token) : [];
      for (const orgId of req.organizationIds) {
        if (!orgIds.includes(orgId)) return forbidden(payload, "Forbidden");
      }
    }
  },
};

export default tenantScopePlugin;
