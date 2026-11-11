import { describe, expect, test } from "bun:test";

import { EnvValidationError, validateEnv } from "./env.config";

// A 32-byte (64 hex char) key, the shape tokenEncryption requires
const VALID_KEY = "a".repeat(64);

const baseRequired = {
  DATABASE_URL: "postgres://localhost/myfi",
  AUTH_JWKS_URL: "https://identity.omni.dev/.well-known/jwks.json",
  TOKEN_ENCRYPTION_KEY: VALID_KEY,
};

describe("validateEnv", () => {
  test("passes when all required vars are present", () => {
    const warnings: string[] = [];

    expect(() =>
      validateEnv(
        { ...baseRequired, PLAID_CLIENT_ID: "x", PLAID_SECRET: "y" },
        (msg) => warnings.push(msg),
      ),
    ).not.toThrow();
  });

  test("throws when a required var is missing", () => {
    const { TOKEN_ENCRYPTION_KEY: _omit, ...withoutKey } = baseRequired;

    expect(() => validateEnv(withoutKey, () => {})).toThrow(EnvValidationError);
    expect(() => validateEnv(withoutKey, () => {})).toThrow(
      /TOKEN_ENCRYPTION_KEY/,
    );
  });

  test("lists every missing required var in the message", () => {
    let thrown: unknown;

    try {
      validateEnv({ AUTH_JWKS_URL: "https://x" }, () => {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(EnvValidationError);
    expect((thrown as Error).message).toContain("DATABASE_URL");
    expect((thrown as Error).message).toContain("TOKEN_ENCRYPTION_KEY");
  });

  test("throws when TOKEN_ENCRYPTION_KEY is malformed (not 64 hex chars)", () => {
    expect(() =>
      validateEnv(
        { ...baseRequired, TOKEN_ENCRYPTION_KEY: "tooshort" },
        () => {},
      ),
    ).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  test("never includes a secret value in the error message", () => {
    let thrown: unknown;

    try {
      validateEnv(
        { ...baseRequired, TOKEN_ENCRYPTION_KEY: "deadbeef" },
        () => {},
      );
    } catch (err) {
      thrown = err;
    }

    expect((thrown as Error).message).not.toContain("deadbeef");
  });

  test("warns (does not throw) when an optional integration is unset", () => {
    const warnings: string[] = [];

    validateEnv(baseRequired, (msg) => warnings.push(msg));

    // Plaid, Gusto, and Synapse are all absent from baseRequired
    expect(warnings.some((w) => w.includes("PLAID"))).toBe(true);
    expect(warnings.some((w) => w.includes("disabled"))).toBe(true);
  });

  test("does not warn for an optional integration that is fully configured", () => {
    const warnings: string[] = [];

    validateEnv(
      { ...baseRequired, PLAID_CLIENT_ID: "x", PLAID_SECRET: "y" },
      (msg) => warnings.push(msg),
    );

    expect(warnings.some((w) => w.includes("PLAID"))).toBe(false);
  });
});
