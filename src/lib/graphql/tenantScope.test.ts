import { describe, expect, test } from "bun:test";

import { parse } from "graphql";

import { extractScopeRequirements } from "./tenantScope";

const scope = (query: string, vars: Record<string, unknown> = {}) =>
  extractScopeRequirements(parse(query), undefined, vars);

describe("extractScopeRequirements", () => {
  test("returns the bookId from a variable on an allowed field", () => {
    const r = scope(
      "query Q($b: UUID!) { accounts(condition: { bookId: $b }) { nodes { id } } }",
      { b: "book-1" },
    );
    expect(r).toEqual({ bookIds: ["book-1"], organizationIds: [] });
  });

  test("returns the bookId from an inline literal (not just variables)", () => {
    const r = scope(
      '{ journalEntries(condition: { bookId: "book-9" }) { nodes { id } } }',
    );
    expect(r).toEqual({ bookIds: ["book-9"], organizationIds: [] });
  });

  test("books is scoped by organizationId", () => {
    const r = scope(
      "query Q($o: String!) { books(condition: { organizationId: $o }) { nodes { id } } }",
      { o: "org-1" },
    );
    expect(r).toEqual({ bookIds: [], organizationIds: ["org-1"] });
  });

  test("rejects an un-allowlisted root field (cross-tenant surface)", () => {
    const r = scope("{ vendors { nodes { name } } }");
    expect(r).toEqual({ error: 'Field "vendors" is not permitted' });
  });

  test("rejects an allowed field with no book scope", () => {
    const r = scope("{ accounts { nodes { id } } }");
    expect("error" in r && r.error).toMatch(/must be scoped to a book/);
  });

  test("rejects mutations", () => {
    const r = scope("mutation { createBook(input: {}) { clientMutationId } }");
    expect("error" in r && r.error).toMatch(/Only read queries/);
  });

  test("collects ids across multiple root fields", () => {
    const r = scope(
      '{ accounts(condition: { bookId: "b1" }) { nodes { id } } budgets(condition: { bookId: "b2" }) { nodes { id } } }',
    );
    expect(r).toEqual({ bookIds: ["b1", "b2"], organizationIds: [] });
  });
});
