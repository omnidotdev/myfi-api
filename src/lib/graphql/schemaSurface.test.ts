import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  assertSchemaSurface,
  findGeneratedCrudMutations,
  listRootFields,
  loadSchema,
} from "@omnidotdev/providers/graphql-surface";

import { ALLOWED_QUERY_FIELDS, ORG_SCOPED_FIELDS } from "./tenantScope";

import type { SchemaSurfacePolicy } from "@omnidotdev/providers/graphql-surface";

/**
 * Reviewed GraphQL surface.
 *
 * tenantScope runs before execution and permits only the whitelisted root
 * query fields, each scoped by a `bookId` (book viewer access) or
 * `organizationId` (workspace membership) condition. Every other root field is
 * refused at execution, so a newly generated table read is closed by default.
 * Generated create/update/delete mutations are removed from the schema (writes
 * go through REST), and tenantScope refuses any mutation regardless
 */
const schema = loadSchema(
  join(import.meta.dir, "../../generated/graphql/schema.graphql"),
);
const { Query } = listRootFields(schema);

const POLICY: SchemaSurfacePolicy = {
  Query: Object.fromEntries(
    Query.map((field) => [
      field,
      ALLOWED_QUERY_FIELDS.has(field)
        ? ORG_SCOPED_FIELDS.has(field)
          ? "workspace member, scoped by organizationId condition (tenantScope)"
          : "book viewer, scoped by bookId condition (tenantScope)"
        : "refused at execution: not in the tenantScope whitelist",
    ]),
  ),
  Mutation: {},
};

describe("GraphQL schema surface", () => {
  test("matches the reviewed policy", () => {
    assertSchemaSurface(schema, POLICY);
  });

  test("exposes no mutations", () => {
    expect(findGeneratedCrudMutations(schema)).toEqual([]);
    expect(schema.getMutationType()).toBeUndefined();
  });
});
