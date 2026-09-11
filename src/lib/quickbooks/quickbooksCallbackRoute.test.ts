import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

import {
  mockDbPool,
  mockInsertOnConflict,
  mockInsertValues,
  mockUpdateWhere,
  resetDbMock,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// env.config destructures process.env at import time and TOKEN_ENCRYPTION_KEY is
// unset in the test env, so the OAuth-state helper would have no signing key.
// Spread the real module (keeping unrelated exports intact) and supply a valid
// 32-byte (64 hex char) key so signOauthState / verifyOauthState work
const TEST_KEY = "a".repeat(64);
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  TOKEN_ENCRYPTION_KEY: TEST_KEY,
}));

const mockEncryptToken = mock((plaintext: string) => `enc(${plaintext})`);
const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

// Real client so unrelated exports stay intact; only exchangeCode is stubbed.
// quickbooksClient.test.ts imports via ?real, so this override never reaches it
// @ts-expect-error -- query-param import has no type declarations
const realClient = await import("./quickbooksClient.ts?real");
type Tokens = { accessToken: string; refreshToken: string; realmId: string };
let exchangeImpl: (code: string, realmId: string) => Promise<Tokens> = (
  _code,
  realmId,
) => Promise.resolve({ accessToken: "at", refreshToken: "rt", realmId });
const mockExchangeCode = mock((code: string, realmId: string) =>
  exchangeImpl(code, realmId),
);
mock.module("./quickbooksClient", () => ({
  ...realClient,
  exchangeCode: mockExchangeCode,
}));

mock.module("./quickbooksConfig", () => ({ isQuickbooksConfigured: true }));

// The genuine config module, so the mock can be undone after this file's tests.
// quickbooksConfig.test.ts runs later and imports the real module, so leaving
// isQuickbooksConfigured stubbed would leak into it
// @ts-expect-error -- query-param import has no type declarations
const realConfig = await import("./quickbooksConfig.ts?real");
afterAll(() => {
  mock.module("./quickbooksConfig", () => ({ ...realConfig }));
});

const { signOauthState } = await import("lib/oauth/state");

const { quickbooksCallbackRoute } = await import("./quickbooksCallbackRoute");

const app = quickbooksCallbackRoute;

const SUCCESS = "/settings/connections";
const ERROR = "/settings/connections?error=quickbooks";

// A valid signed state for book-1, as the connect route would mint
const VALID_STATE = signOauthState("book-1");

const callback = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return app.handle(
    new Request(`http://localhost/api/quickbooks/callback?${qs}`),
  );
};

let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  resetDbMock();
  mockExchangeCode.mockClear();
  mockEncryptToken.mockClear();
  exchangeImpl = (_code, realmId) =>
    Promise.resolve({ accessToken: "at", refreshToken: "rt", realmId });
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("GET /api/quickbooks/callback", () => {
  test("exchanges the code, encrypts tokens, upserts a connection, and redirects", async () => {
    const res = await callback({
      code: "auth-code",
      realmId: "realm-1",
      state: VALID_STATE,
    });

    expect(res.headers.get("location")).toBe(SUCCESS);

    expect(mockExchangeCode).toHaveBeenCalledWith("auth-code", "realm-1");
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        provider: "quickbooks",
        realmId: "realm-1",
        accessToken: "enc(at)",
        refreshToken: "enc(rt)",
        status: "active",
      }),
    );
  });

  test("upserts atomically on reconnect with no separate select or update branch", async () => {
    const res = await callback({
      code: "auth-code",
      realmId: "realm-2",
      state: VALID_STATE,
    });

    expect(res.headers.get("location")).toBe(SUCCESS);
    // A single atomic upsert, never a select-then-update branch that could race
    expect(mockDbPool.select).not.toHaveBeenCalled();
    expect(mockUpdateWhere).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockInsertOnConflict).toHaveBeenCalledTimes(1);
  });

  test("upsert conflicts on the book, scoped to the quickbooks partial index, updating tokens", async () => {
    await callback({
      code: "auth-code",
      realmId: "realm-3",
      state: VALID_STATE,
    });

    // The conflict target is the book column, narrowed by targetWhere so only
    // the quickbooks-only partial index is used (Plaid/OFX rows are untouched)
    const config = mockInsertOnConflict.mock.calls[0]?.[0] as {
      target: unknown;
      targetWhere: unknown;
      set: Record<string, unknown>;
    };
    expect(config.target).toBeDefined();
    expect(config.targetWhere).toBeDefined();
    expect(config.set).toEqual(
      expect.objectContaining({
        realmId: "realm-3",
        accessToken: "enc(at)",
        refreshToken: "enc(rt)",
        status: "active",
      }),
    );
  });

  test("redirects to a generic error page when QuickBooks is not configured", async () => {
    mock.module("./quickbooksConfig", () => ({
      isQuickbooksConfigured: false,
    }));
    // @ts-expect-error -- query-param import forces a fresh module, no types
    const fresh = await import("./quickbooksCallbackRoute.ts?unconfigured");
    const unconfigured = fresh.quickbooksCallbackRoute;

    const res = await unconfigured.handle(
      new Request(
        "http://localhost/api/quickbooks/callback?code=c&realmId=r&state=book-1",
      ),
    );

    expect(res.headers.get("location")).toBe(ERROR);
    // Nothing is exchanged when the integration is disabled
    expect(mockExchangeCode).not.toHaveBeenCalled();

    // Restore the configured mock for subsequent tests
    mock.module("./quickbooksConfig", () => ({ isQuickbooksConfigured: true }));
  });

  test("redirects to the error page when the user denies consent at Intuit", async () => {
    const res = await callback({ state: "book-1", error: "access_denied" });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  test("redirects to the error page when the code is missing", async () => {
    const res = await callback({ state: "book-1", realmId: "realm-1" });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  test("rejects a forged (raw bookId) state without exchanging or writing", async () => {
    // An attacker points the callback at a victim's raw bookId plus their own
    // OAuth code. The unsigned state fails verification, so the code is never
    // exchanged and no connection is written for the victim's book
    const res = await callback({
      code: "attacker-code",
      realmId: "attacker-realm",
      state: "victim-book",
    });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(mockExchangeCode).not.toHaveBeenCalled();
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

    const res = await callback({
      code: "attacker-code",
      realmId: "attacker-realm",
      state: tampered,
    });

    expect(res.headers.get("location")).toBe(ERROR);
    expect(mockExchangeCode).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("redirects to the error page on failure without leaking the code or tokens", async () => {
    exchangeImpl = () =>
      Promise.reject(new Error("intuit rejected secret-token-abc123"));

    const res = await callback({
      code: "auth-code-xyz",
      realmId: "realm-1",
      state: VALID_STATE,
    });

    const location = res.headers.get("location");
    expect(location).toBe(ERROR);
    // The redirect URL never carries the OAuth code or any secret
    expect(location).not.toContain("auth-code-xyz");
    expect(location).not.toContain("secret-token");

    // Server-side logs carry only the error class, never the code or a token
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0]);
    expect(logged).toContain("(Error)");
    expect(logged).not.toContain("auth-code-xyz");
    expect(logged).not.toContain("secret-token");
  });
});
