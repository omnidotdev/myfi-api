import { describe, expect, test } from "bun:test";

import { validateRecategorize } from "./recategorize";

const base = {
  fromAccountId: "acct-from",
  toAccountId: "acct-to",
  vendorInBook: true,
  fromAccountInBook: true,
  toAccountInBook: true,
};

describe("validateRecategorize", () => {
  test("accepts a well-formed request", () => {
    expect(validateRecategorize(base)).toEqual({ ok: true });
  });

  test("rejects an unknown vendor", () => {
    const r = validateRecategorize({ ...base, vendorInBook: false });
    expect(r.ok).toBe(false);
  });

  test("rejects identical source and target accounts", () => {
    const r = validateRecategorize({ ...base, toAccountId: "acct-from" });
    expect(r.ok).toBe(false);
  });

  test("rejects a missing source or target id", () => {
    expect(validateRecategorize({ ...base, fromAccountId: "" }).ok).toBe(false);
    expect(validateRecategorize({ ...base, toAccountId: "" }).ok).toBe(false);
  });

  test("rejects a source account outside the book", () => {
    const r = validateRecategorize({ ...base, fromAccountInBook: false });
    expect(r.ok).toBe(false);
  });

  test("rejects a target account outside the book", () => {
    const r = validateRecategorize({ ...base, toAccountInBook: false });
    expect(r.ok).toBe(false);
  });
});
