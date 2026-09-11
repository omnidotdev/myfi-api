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
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  GUSTO_CLIENT_ID: "client-id",
  GUSTO_CLIENT_SECRET: "client-secret",
  GUSTO_REDIRECT_URI: "https://app.example/api/payroll/callback",
}));

const { payrollCallbackRoute } = await import("./payrollRoutes");

const app = payrollCallbackRoute;

const SUCCESS = "/settings/connections";

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
    const res = await callback({ code: "auth-code", state: "book-1" });

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
    const res = await callback({ code: "auth-code-xyz", state: "book-1" });

    const location = res.headers.get("location");
    expect(location).toBe(SUCCESS);
    expect(location).not.toContain("auth-code-xyz");
    expect(location).not.toContain("at");
    expect(location).not.toContain("rt");
  });
});
