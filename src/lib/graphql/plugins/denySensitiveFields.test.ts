import { describe, expect, test } from "bun:test";

import { buildSchema, parse, validate } from "graphql";

import { DenySensitiveFieldsRule } from "./denySensitiveFields.plugin";

// A stand-in schema exposing the encrypted columns the way Postgraphile would
const schema = buildSchema(`
  type ConnectedAccount { id: ID!, accessToken: String, institutionName: String }
  type Vendor { id: ID!, name: String, taxId: String }
  type Book { id: ID!, name: String, ein: String }
  type Query {
    connectedAccount: ConnectedAccount
    vendor: Vendor
    book: Book
  }
`);

const errors = (query: string) =>
  validate(schema, parse(query), [DenySensitiveFieldsRule]);

describe("DenySensitiveFieldsRule", () => {
  test("rejects selecting an encrypted access token", () => {
    const errs = errors("{ connectedAccount { id accessToken } }");
    expect(errs.length).toBe(1);
    expect(errs[0].message).toMatch(/accessToken/);
  });

  test("rejects selecting an encrypted TIN and EIN", () => {
    expect(errors("{ vendor { taxId } }").length).toBe(1);
    expect(errors("{ book { ein } }").length).toBe(1);
  });

  test("allows a query that selects only non-sensitive fields", () => {
    expect(
      errors("{ connectedAccount { id institutionName } vendor { name } }")
        .length,
    ).toBe(0);
  });
});
