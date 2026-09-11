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

const { quickbooksCallbackRoute } = await import("./quickbooksCallbackRoute");

const app = quickbooksCallbackRoute;

const SUCCESS = "/settings/connections";
const ERROR = "/settings/connections?error=quickbooks";

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
      state: "book-1",
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
      state: "book-1",
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
      state: "book-1",
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

  test("redirects to the error page on failure without leaking the code or tokens", async () => {
    exchangeImpl = () =>
      Promise.reject(new Error("intuit rejected secret-token-abc123"));

    const res = await callback({
      code: "auth-code-xyz",
      realmId: "realm-1",
      state: "book-1",
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
