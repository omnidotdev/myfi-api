import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const mockEncryptToken = mock((plaintext: string) => `enc(${plaintext})`);
const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

// A valid 32-byte (64 hex char) key so signOauthState can derive its HMAC key.
// Spread the real env so unrelated exports stay intact, overriding only Gusto
// OAuth config and the token key
const TEST_KEY = "a".repeat(64);
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  GUSTO_CLIENT_ID: "client-id",
  GUSTO_REDIRECT_URI: "https://app.example/api/payroll/callback",
  TOKEN_ENCRYPTION_KEY: TEST_KEY,
}));

const { verifyOauthState } = await import("lib/oauth/state");

const { default: payrollRoutes } = await import("./payrollRoutes");

const app = payrollRoutes;

describe("POST /api/payroll/connect", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("builds a Gusto authorize URL carrying a signed state, not the raw bookId", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/payroll/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: "book-1" }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    const parsed = new URL(json.authUrl);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://api.gusto.com/oauth/authorize",
    );
    expect(parsed.searchParams.get("client_id")).toBe("client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.example/api/payroll/callback",
    );

    // The state is NOT the raw bookId; it is an HMAC-signed token that only the
    // server can mint, and it verifies back to the bookId
    const state = parsed.searchParams.get("state");
    expect(state).not.toBe("book-1");
    expect(state).toBeTruthy();
    expect(verifyOauthState(state as string)).toEqual({ bookId: "book-1" });
  });
});
