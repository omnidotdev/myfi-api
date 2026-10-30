import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Only create/list are exercised here; they carry bookId and are guarded by the
// global middleware, so this file does not mock bookAccess.middleware (mocking
// it globally leaks into the middleware's own integration test)

const { default: savedReportRoutes } = await import("./savedReportRoutes");
const app = savedReportRoutes;

describe("savedReportRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a saved report", async () => {
    setInsertReturningData([
      {
        id: "sr-1",
        bookId: "book-1",
        name: "Q1 P&L",
        reportType: "profit-and-loss",
        params: { basis: "cash" },
      },
    ]);
    const res = await app.handle(
      new Request("http://localhost/api/saved-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Q1 P&L",
          reportType: "profit-and-loss",
          params: { basis: "cash" },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.savedReport).toMatchObject({ name: "Q1 P&L" });
  });

  test("lists and filters by report type", async () => {
    setSelectResults([
      [
        { id: "sr-1", reportType: "profit-and-loss" },
        { id: "sr-2", reportType: "balance-sheet" },
      ],
    ]);
    const res = await app.handle(
      new Request(
        "http://localhost/api/saved-reports?bookId=book-1&reportType=profit-and-loss",
      ),
    );
    const data = await res.json();
    expect(data.savedReports).toHaveLength(1);
    expect(data.savedReports[0].id).toBe("sr-1");
  });
});
