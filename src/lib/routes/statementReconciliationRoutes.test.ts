import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
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

const { default: statementReconciliationRoutes } = await import(
  "./statementReconciliationRoutes"
);

const app = statementReconciliationRoutes;

const makeReconciliation = (overrides: Record<string, unknown> = {}) => ({
  id: "recon-1",
  bookId: "book-1",
  accountId: "acct-1",
  statementDate: "2026-03-31",
  statementBalance: "5000.0000",
  beginningBalance: "4000.0000",
  status: "in_progress",
  completedAt: null,
  discrepancy: null,
  createdAt: "2026-03-15",
  ...overrides,
});

describe("GET /api/statement-reconciliations", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("returns 400 when bookId is missing", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/statement-reconciliations"),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("bookId is required");
  });

  test("returns reconciliations for a book", async () => {
    const recon = makeReconciliation();
    setSelectResults([[recon]]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/statement-reconciliations?bookId=book-1",
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reconciliations).toHaveLength(1);
    expect(json.reconciliations[0].id).toBe("recon-1");
  });
});

describe("POST /api/statement-reconciliations", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("creates a new reconciliation", async () => {
    const created = makeReconciliation();
    // First select: look up previous completed reconciliation
    setSelectResults([[]]);
    mockInsertValues.mockReturnValueOnce({
      returning: mock(() => [created]),
    });

    const res = await app.handle(
      new Request("http://localhost/api/statement-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          accountId: "acct-1",
          statementDate: "2026-03-31",
          statementBalance: "5000.0000",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reconciliation.id).toBe("recon-1");
  });
});

describe("POST /:id/complete", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("completes a reconciliation", async () => {
    const existing = makeReconciliation();
    const completed = makeReconciliation({
      status: "completed",
      completedAt: "2026-03-31T00:00:00Z",
      discrepancy: "0",
    });

    setSelectResults([[existing]]);
    setUpdateReturningData([completed]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/statement-reconciliations/recon-1/complete",
        { method: "POST" },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reconciliation.status).toBe("completed");
    expect(mockEmitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "myfi.statement_reconciliation.completed",
      }),
    );
  });

  test("rejects completing an already completed reconciliation", async () => {
    const existing = makeReconciliation({ status: "completed" });
    setSelectResults([[existing]]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/statement-reconciliations/recon-1/complete",
        { method: "POST" },
      ),
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Reconciliation is already completed");
  });
});

describe("PATCH /:id/lines/:lineId", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("toggles cleared status", async () => {
    const existing = makeReconciliation();
    setSelectResults([[existing]]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/statement-reconciliations/recon-1/lines/line-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleared: true }),
        },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("rejects toggle on completed reconciliation", async () => {
    const existing = makeReconciliation({ status: "completed" });
    setSelectResults([[existing]]);

    const res = await app.handle(
      new Request(
        "http://localhost/api/statement-reconciliations/recon-1/lines/line-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleared: true }),
        },
      ),
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Reconciliation is already completed");
  });
});
