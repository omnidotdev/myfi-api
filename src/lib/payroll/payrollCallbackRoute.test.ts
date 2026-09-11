import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, mockInsertValues, resetDbMock } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const mockEncryptToken = mock((plaintext: string) => `enc(${plaintext})`);
const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

// env.config destructures process.env at import time, and another test file may
// have already imported it with the Gusto vars unset. Spread the real module so
// every unrelated export stays intact, overriding only the Gusto OAuth config
// A valid 32-byte (64 hex char) key so the OAuth-state helper can sign/verify
const TEST_KEY = "a".repeat(64);
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  GUSTO_CLIENT_ID: "client-id",
  GUSTO_CLIENT_SECRET: "client-secret",
  GUSTO_REDIRECT_URI: "https://app.example/api/payroll/callback",
  TOKEN_ENCRYPTION_KEY: TEST_KEY,
}));

const { signOauthState } = await import("lib/oauth/state");

const { payrollCallbackRoute } = await import("./payrollRoutes");

const app = payrollCallbackRoute;

const SUCCESS = "/settings/connections";
const ERROR = "/settings/connections?error=payroll";

// A valid signed state for book-1, as the connect route would mint
const VALID_STATE = signOauthState("book-1");

const callback = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return app.handle(new Request(`http://localhost/api/payroll/callback?${qs}`));
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetDbMock();
  mockEncryptToken.mockClear();
  // Gusto token exchange, then company info lookup
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/oauth/token")) {
      return new Response(
        JSON.stringify({ access_token: "at", refresh_token: "rt" }),
        { status: 200 },
      );
    }
    if (url.includes("/v1/me")) {
      return new Response(JSON.stringify({ uuid: "company-1" }), {
        status: 200,
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /api/payroll/callback", () => {
  test("exchanges the code, encrypts tokens, inserts a connection, and redirects", async () => {
    const res = await callback({ code: "auth-code", state: VALID_STATE });

    // The regression guard: the callback must issue a real browser redirect
    // (302 + Location), not a 200 with no Location as set.redirect produced
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SUCCESS);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        provider: "gusto",
        accessToken: "enc(at)",
        refreshToken: "enc(rt)",
        companyId: "company-1",
        status: "active",
      }),
    );
  });

  test("the redirect URL never carries the OAuth code or any token", async () => {
    const res = await callback({ code: "auth-code-xyz", state: VALID_STATE });

    const location = res.headers.get("location");
    expect(location).toBe(SUCCESS);
    expect(location).not.toContain("auth-code-xyz");
    expect(location).not.toContain("at");
    expect(location).not.toContain("rt");
  });

  test("rejects a forged (raw bookId) state without exchanging or writing", async () => {
    // An attacker points the callback at a victim's raw bookId plus their own
    // OAuth code. The unsigned state fails verification, so the code is never
    // exchanged and no connection is written for the victim's book
    const res = await callback({ code: "attacker-code", state: "victim-book" });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("rejects a tampered signed state without exchanging or writing", async () => {
    // Flip a bit in the first signature byte so the decoded bytes are
    // guaranteed to differ from the real signature. Flipping the last base64url
    // char is NOT reliable: the final char carries only 4 significant bits, so
    // some flips decode to the SAME 32 bytes and would still verify
    const [payload, sigPart] = VALID_STATE.split(".");
    const realSig = Buffer.from(sigPart, "base64url");
    const tamperedSig = Buffer.from(realSig);
    tamperedSig[0] ^= 0xff;
    // Guard: the tamper actually changed the signature bytes
    expect(tamperedSig.equals(realSig)).toBe(false);
    const tampered = `${payload}.${tamperedSig.toString("base64url")}`;

    const res = await callback({ code: "attacker-code", state: tampered });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
