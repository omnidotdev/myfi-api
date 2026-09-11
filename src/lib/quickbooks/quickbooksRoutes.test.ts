import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

mock.module("lib/config/env.config", () => ({
  QBO_CLIENT_ID: "test-client-id",
  QBO_REDIRECT_URI: "https://app.myfi.test/api/quickbooks/callback",
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

// mock.module is global across every test file in one process, and this file
// sorts before reconcile.test.ts, so leaving the stub registered would clobber
// that file's real subject. Import the real module via a query param (which
// bypasses the mock registry) and restore it once this file's tests finish,
// mirroring the same afterAll restore reconcile.test.ts does for its stubs
// @ts-expect-error -- query-param import forces the real module, no types
const realReconcile = await import("./reconcile.ts?real");
afterAll(() => {
  mock.module("./reconcile", () => ({ ...realReconcile }));
});

const { default: quickbooksRoutes } = await import("./quickbooksRoutes");

const app = quickbooksRoutes;

describe("POST /api/quickbooks/connect", () => {
  beforeEach(() => {
    resetDbMock();
    mockRunBackfill.mockClear();
  });

  test("builds an Intuit authorize URL carrying bookId, scope, and redirect_uri", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: "book-1" }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.authUrl).toContain("state=book-1");
    expect(json.authUrl).toContain("scope=com.intuit.quickbooks.accounting");

    const parsed = new URL(json.authUrl);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("book-1");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.myfi.test/api/quickbooks/callback",
    );
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
