import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSchema } from "graphql";
import { createYoga } from "graphql-yoga";

// Control checkBookAccess + org membership per test
let accessibleBooks = new Set<string>();
let memberOrgs = new Set<string>();

mock.module("lib/middleware/bookAccess.middleware", () => ({
  checkBookAccess: (_userId: string, bookId: string) =>
    Promise.resolve(accessibleBooks.has(bookId) ? "viewer" : null),
}));
mock.module("lib/auth", () => ({
  extractBearerToken: () => "t",
  resolveUserOrgIds: () => Promise.resolve([...memberOrgs]),
}));

const { default: tenantScopePlugin } = await import("./tenantScope.plugin");

const schema = buildSchema(`
  scalar UUID
  input AccountCondition { bookId: UUID }
  input BookCondition { organizationId: String }
  type Query {
    accounts(condition: AccountCondition): [String]
    books(condition: BookCondition): [String]
    vendors: [String]
  }
`);

const yoga = createYoga({
  schema,
  plugins: [tenantScopePlugin],
  // Stand in for the authentication plugin: inject the observer + request
  context: ({ request }) => ({ observer: { id: "user-1" }, request }),
});

const run = async (query: string) => {
  const res = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer t",
    },
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{
    data?: Record<string, unknown> | null;
    errors?: { message: string }[];
  }>;
};

describe("tenantScopePlugin (yoga pipeline)", () => {
  beforeEach(() => {
    accessibleBooks = new Set();
    memberOrgs = new Set();
  });

  test("allows a query scoped to a book the user can access", async () => {
    accessibleBooks = new Set(["b1"]);
    const res = await run('{ accounts(condition: { bookId: "b1" }) }');
    expect(res.errors).toBeUndefined();
  });

  test("blocks a query scoped to a book the user cannot access", async () => {
    accessibleBooks = new Set(["b1"]);
    const res = await run('{ accounts(condition: { bookId: "other" }) }');
    expect(res.errors?.[0]?.message).toBe("Forbidden");
    expect(res.data?.accounts ?? null).toBeNull();
  });

  test("blocks an un-allowlisted cross-tenant field", async () => {
    const res = await run("{ vendors }");
    expect(res.errors?.[0]?.message).toMatch(/not permitted/);
  });

  test("allows books for an org the user belongs to, blocks otherwise", async () => {
    memberOrgs = new Set(["org-1"]);
    const ok = await run('{ books(condition: { organizationId: "org-1" }) }');
    expect(ok.errors).toBeUndefined();
    const no = await run('{ books(condition: { organizationId: "org-2" }) }');
    expect(no.errors?.[0]?.message).toBe("Forbidden");
  });
});
