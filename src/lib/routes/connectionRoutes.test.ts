import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockUpdateWhere,
  resetDbMock,
  setSelectResults,
  setUpdateReturningData,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const mockEmitAudit = mock(() => {});
mock.module("lib/audit", () => ({
  emitAudit: mockEmitAudit,
  SYSTEM_ACTOR: { id: "system" },
}));

const { default: connectionRoutes } = await import("./connectionRoutes");

const app = connectionRoutes;

const makeConnection = (overrides: Record<string, unknown> = {}) => ({
  id: "conn-1",
  bookId: "book-1",
  provider: "plaid",
  providerAccountId: "plaid-123",
  accountId: null,
  institutionName: "Test Bank",
  mask: "1234",
  status: "active",
  lastSyncedAt: null,
  createdAt: "2026-01-01",
  ...overrides,
});

describe("PATCH /api/connections/:id", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("links an account to a connected account", async () => {
    const existing = makeConnection();
    const updated = makeConnection({ accountId: "acct-1" });

    setSelectResults([[existing]]);
    setUpdateReturningData([updated]);

    const res = await app.handle(
      new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct-1" }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.connection.accountId).toBe("acct-1");
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockEmitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "myfi.connection.linked",
      }),
    );
  });

  test("returns 404 when connection not found", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/connections/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct-1" }),
      }),
    );

    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Connected account not found");
  });

  test("unlinks by setting accountId to null", async () => {
    const existing = makeConnection({ accountId: "acct-1" });
    const updated = makeConnection({ accountId: null });

    setSelectResults([[existing]]);
    setUpdateReturningData([updated]);

    const res = await app.handle(
      new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: null }),
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.connection.accountId).toBeNull();
  });
});
