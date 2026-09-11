import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// A valid 32-byte (64 hex char) key so signOauthState can derive its HMAC key.
// Spread the real module so unrelated named exports stay present: mock.module is
// global across files, and dropping them would break other modules that
// statically import those names
const TEST_KEY = "a".repeat(64);
const realEnv = await import("lib/config/env.config");

mock.module("lib/config/env.config", () => ({
  ...realEnv,
  QBO_CLIENT_ID: "test-client-id",
  QBO_REDIRECT_URI: "https://app.myfi.test/api/quickbooks/callback",
  TOKEN_ENCRYPTION_KEY: TEST_KEY,
}));

const QBO_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";

// Configured by default; the unconfigured case re-mocks and re-imports a fresh
// route instance below, since a named import binds its value at module eval
mock.module("./quickbooksConfig", () => ({
  QBO_AUTHORIZE_URL,
  isQuickbooksConfigured: true,
}));

const mockRunBackfill = mock(() => Promise.resolve({ entriesImported: 7 }));
mock.module("./backfill", () => ({ runBackfill: mockRunBackfill }));

const mockRunReconciliation = mock(() =>
  Promise.resolve({ totalVariance: "0.0000", mismatchCount: 0 }),
);
mock.module("./reconcile", () => ({
  runReconciliation: mockRunReconciliation,
}));

// The real cutover module is imported via a query param (bypassing the mock
// registry) so the genuine CutoverNotReconciledError class identity is
// preserved: the route's instanceof check must recognize errors this test
// throws. Only runCutover is stubbed
// @ts-expect-error -- query-param import forces the real module, no types
const realCutover = await import("./cutover.ts?real");
const { CutoverNotReconciledError } = realCutover;
const mockRunCutover = mock(() =>
  Promise.resolve({ cutoverId: "c1", alreadyCutOver: false }),
);
mock.module("./cutover", () => ({
  ...realCutover,
  runCutover: mockRunCutover,
}));

// mock.module is global across every test file in one process, and this file
// sorts before reconcile.test.ts, so leaving the stub registered would clobber
// that file's real subject. Import the real module via a query param (which
// bypasses the mock registry) and restore it once this file's tests finish,
// mirroring the same afterAll restore reconcile.test.ts does for its stubs
// @ts-expect-error -- query-param import forces the real module, no types
const realReconcile = await import("./reconcile.ts?real");
afterAll(() => {
  mock.module("./reconcile", () => ({ ...realReconcile }));
  mock.module("./cutover", () => ({ ...realCutover }));
});

const { verifyOauthState } = await import("lib/oauth/state");

const { default: quickbooksRoutes } = await import("./quickbooksRoutes");

const app = quickbooksRoutes;

describe("POST /api/quickbooks/connect", () => {
  beforeEach(() => {
    resetDbMock();
    mockRunBackfill.mockClear();
  });

  test("builds an Intuit authorize URL carrying a signed state, scope, and redirect_uri", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: "book-1" }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.authUrl).toContain("scope=com.intuit.quickbooks.accounting");

    const parsed = new URL(json.authUrl);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.myfi.test/api/quickbooks/callback",
    );

    // The state is NOT the raw bookId; it is an HMAC-signed token that only the
    // server can mint, and it verifies back to the bookId
    const state = parsed.searchParams.get("state");
    expect(state).not.toBe("book-1");
    expect(state).toBeTruthy();
    expect(verifyOauthState(state as string)).toEqual({ bookId: "book-1" });
  });

  test("returns a generic 500 when QuickBooks is not configured", async () => {
    // Re-mock config as unconfigured and import a fresh route instance so the
    // named import binds isQuickbooksConfigured=false at eval time
    mock.module("./quickbooksConfig", () => ({
      QBO_AUTHORIZE_URL,
      isQuickbooksConfigured: false,
    }));
    // @ts-expect-error -- query-param import forces a fresh module, no types
    const fresh = await import("./quickbooksRoutes.ts?unconfigured");
    const unconfiguredRoutes = fresh.default;

    const res = await unconfiguredRoutes.handle(
      new Request("http://localhost/api/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: "book-1" }),
      }),
    );

    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("QuickBooks not configured");
    // No internals, credentials, or env values leaked
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("test-client-id");
    expect(serialized).not.toContain("QBO_");
  });
});

describe("POST /api/quickbooks/backfill", () => {
  beforeEach(() => {
    resetDbMock();
    mockRunBackfill.mockClear();
  });

  test("creates a pending migration row and starts the backfill, returning 202", async () => {
    // Ownership check: the connected account belongs to the requested book
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);
    setInsertReturningData([{ id: "mig-1" }]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "2026-01-01",
        }),
      }),
    );

    // Accepted for async processing; no entriesImported since it runs detached
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.migrationId).toBeTruthy();
    expect(json.entriesImported).toBeUndefined();

    // A pending migration row is created with the expected shape
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        connectedAccountId: "conn-1",
        status: "pending",
        periodStart: "2026-01-01",
        periodEnd: null,
      }),
    );

    // The backfill is invoked (fire-and-forget) with the new migration row id
    expect(mockRunBackfill).toHaveBeenCalledWith({
      migrationId: json.migrationId,
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });
  });

  test("rejects a connectedAccountId from a different book with 403", async () => {
    // The account exists but belongs to another book (cross-tenant attempt)
    setSelectResults([
      [{ id: "conn-1", bookId: "other-book", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
        }),
      }),
    );

    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toBe("Forbidden");
    // No migration row created and no backfill started
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunBackfill).not.toHaveBeenCalled();
  });

  test("rejects an unknown connectedAccountId with 403", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "missing",
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(mockRunBackfill).not.toHaveBeenCalled();
  });
});

describe("POST /api/quickbooks/reconcile", () => {
  beforeEach(() => {
    resetDbMock();
    mockRunReconciliation.mockClear();
  });

  test("creates a pending reconciliation row and starts the run, returning 202", async () => {
    // Ownership check: the connected account belongs to the requested book
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);
    setInsertReturningData([{ id: "recon-1" }]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
        }),
      }),
    );

    // Accepted for async processing; no aggregates since the run is detached
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.reconciliationId).toBeTruthy();
    expect(json.totalVariance).toBeUndefined();
    expect(json.mismatchCount).toBeUndefined();

    // A pending reconciliation row is created with the requested period
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        connectedAccountId: "conn-1",
        status: "pending",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
      }),
    );

    // The reconciliation is invoked (fire-and-forget) with the new run id
    expect(mockRunReconciliation).toHaveBeenCalledWith({
      reconciliationId: json.reconciliationId,
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });
  });

  test("rejects a malformed periodStart with 400 before any work", async () => {
    // Ownership passes so the date check is what rejects the request
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "01/01/2026",
          periodEnd: "2026-03-31",
        }),
      }),
    );

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid period");
    // No run row created and no reconciliation started
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunReconciliation).not.toHaveBeenCalled();
  });

  test("rejects a period whose start is after its end with 400", async () => {
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "2026-03-31",
          periodEnd: "2026-01-01",
        }),
      }),
    );

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid period");
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunReconciliation).not.toHaveBeenCalled();
  });

  test("ownership 403 takes precedence over a bad date", async () => {
    // Cross-book account AND a malformed date: ownership must reject first
    setSelectResults([
      [{ id: "conn-1", bookId: "other-book", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "nope",
          periodEnd: "also-nope",
        }),
      }),
    );

    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toBe("Forbidden");
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunReconciliation).not.toHaveBeenCalled();
  });

  test("rejects a connectedAccountId from a different book with 403", async () => {
    // The account exists but belongs to another book (cross-tenant attempt)
    setSelectResults([
      [{ id: "conn-1", bookId: "other-book", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
        }),
      }),
    );

    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toBe("Forbidden");
    // No reconciliation row created and no run started
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunReconciliation).not.toHaveBeenCalled();
  });

  test("rejects an unknown connectedAccountId with 403", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "missing",
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockRunReconciliation).not.toHaveBeenCalled();
  });
});

describe("POST /api/quickbooks/cutover", () => {
  beforeEach(() => {
    resetDbMock();
    mockRunCutover.mockClear();
    mockRunCutover.mockResolvedValue({
      cutoverId: "c1",
      alreadyCutOver: false,
    });
  });

  test("cuts a reconciled book over, returning 200 with the cutover id", async () => {
    // Ownership check: the connected account belongs to the requested book
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);
    mockRunCutover.mockResolvedValue({
      cutoverId: "c1",
      alreadyCutOver: false,
    });

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          reconciliationId: "recon-1",
        }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ cutoverId: "c1", alreadyCutOver: false });

    // The cutover runs synchronously with the book, connection, and run ids
    expect(mockRunCutover).toHaveBeenCalledWith({
      bookId: "book-1",
      connectedAccountId: "conn-1",
      reconciliationId: "recon-1",
    });
  });

  test("returns 409 when the book has not reconciled cleanly", async () => {
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);
    mockRunCutover.mockRejectedValue(
      new CutoverNotReconciledError("Book has not reconciled cleanly"),
    );

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          reconciliationId: "recon-1",
        }),
      }),
    );

    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.error).toBe("Book has not reconciled cleanly");
  });

  test("returns a generic 500 on an unexpected failure, leaking no internals", async () => {
    setSelectResults([
      [{ id: "conn-1", bookId: "book-1", provider: "quickbooks" }],
    ]);
    mockRunCutover.mockRejectedValue(
      new Error("db exploded AQAB-secret dec(enc-refresh)"),
    );

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          reconciliationId: "recon-1",
        }),
      }),
    );

    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("Cutover failed");
    // No internal message, token, or stack detail leaks in the response
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("db exploded");
    expect(serialized).not.toContain("AQAB");
    expect(serialized).not.toContain("enc-refresh");
    expect(serialized).not.toContain("dec(");
  });

  test("rejects a connectedAccountId from a different book with 403", async () => {
    // The account exists but belongs to another book (cross-tenant attempt)
    setSelectResults([
      [{ id: "conn-1", bookId: "other-book", provider: "quickbooks" }],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "conn-1",
          reconciliationId: "recon-1",
        }),
      }),
    );

    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toBe("Forbidden");
    // The cutover is never attempted for a mismatched account
    expect(mockRunCutover).not.toHaveBeenCalled();
  });

  test("rejects an unknown connectedAccountId with 403", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          connectedAccountId: "missing",
          reconciliationId: "recon-1",
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(mockRunCutover).not.toHaveBeenCalled();
  });
});

describe("GET /api/quickbooks/status", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("returns all four states populated for a fully migrated book", async () => {
    // The four scoped selects run in order: connection, migration,
    // reconciliation, cutover
    setSelectResults([
      [{ id: "conn-1", realmId: "realm-9", status: "active" }],
      [
        {
          id: "mig-1",
          status: "complete",
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
          entriesImported: 42,
          errorMessage: null,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      [
        {
          id: "recon-1",
          status: "clean",
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
          totalVariance: "0.0000",
          mismatchCount: 0,
          errorMessage: null,
          createdAt: "2026-01-03T00:00:00.000Z",
        },
      ],
      [
        {
          id: "cut-1",
          cutoverAt: "2026-01-04T00:00:00.000Z",
          reconciliationId: "recon-1",
        },
      ],
    ]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/status?bookId=book-1"),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.connection).toEqual({
      id: "conn-1",
      realmId: "realm-9",
      status: "active",
    });
    expect(json.latestMigration).toEqual({
      id: "mig-1",
      status: "complete",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      entriesImported: 42,
      errorMessage: null,
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    expect(json.latestReconciliation).toEqual({
      id: "recon-1",
      status: "clean",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      totalVariance: "0.0000",
      mismatchCount: 0,
      errorMessage: null,
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    expect(json.cutover).toEqual({
      id: "cut-1",
      cutoverAt: "2026-01-04T00:00:00.000Z",
      reconciliationId: "recon-1",
    });
  });

  test("returns all null for a book that never connected QuickBooks", async () => {
    // Every scoped select comes back empty, which is a valid state, not an error
    setSelectResults([[], [], [], []]);

    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/status?bookId=book-1"),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      connection: null,
      latestMigration: null,
      latestReconciliation: null,
      cutover: null,
    });
  });

  test("returns 400 when bookId is missing", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/status"),
    );

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("bookId is required");
  });
});

describe("GET /api/quickbooks/reconciliation/:reconciliationId/lines", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("returns the summary and lines for a reconciliation owned by the book", async () => {
    // First select loads the reconciliation, second loads its lines
    setSelectResults([
      [
        {
          id: "recon-1",
          bookId: "book-1",
          status: "mismatch",
          totalVariance: "12.5000",
          mismatchCount: 1,
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
        },
      ],
      [
        {
          id: "line-1",
          accountName: "Checking",
          qboAccountId: "qbo-1",
          myfiAccountId: "acct-1",
          qboBalance: "100.0000",
          myfiBalance: "112.5000",
          variance: "12.5000",
        },
      ],
    ]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/quickbooks/reconciliation/recon-1/lines?bookId=book-1",
      ),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.reconciliation).toEqual({
      id: "recon-1",
      status: "mismatch",
      totalVariance: "12.5000",
      mismatchCount: 1,
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(json.lines).toEqual([
      {
        id: "line-1",
        accountName: "Checking",
        qboAccountId: "qbo-1",
        myfiAccountId: "acct-1",
        qboBalance: "100.0000",
        myfiBalance: "112.5000",
        variance: "12.5000",
      },
    ]);
  });

  test("returns 404 for a reconciliation belonging to a different book, leaking no lines", async () => {
    // The reconciliation exists but is owned by another book (IDOR attempt).
    // Only the reconciliation lookup should run; lines must never be queried
    setSelectResults([
      [
        {
          id: "recon-1",
          bookId: "other-book",
          status: "clean",
          totalVariance: "0.0000",
          mismatchCount: 0,
          periodStart: "2026-01-01",
          periodEnd: "2026-03-31",
        },
      ],
    ]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/quickbooks/reconciliation/recon-1/lines?bookId=book-1",
      ),
    );

    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Not found");
    expect(json.lines).toBeUndefined();
    expect(json.reconciliation).toBeUndefined();
    // The response leaks neither the owning book nor any line data
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("other-book");
  });

  test("returns 404 for an unknown reconciliation id", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/quickbooks/reconciliation/missing/lines?bookId=book-1",
      ),
    );

    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Not found");
  });

  test("returns 400 when bookId is missing", async () => {
    const res = await app.handle(
      new Request(
        "http://localhost/api/quickbooks/reconciliation/recon-1/lines",
      ),
    );

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("bookId is required");
  });
});
