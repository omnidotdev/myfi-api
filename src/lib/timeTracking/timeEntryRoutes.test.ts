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

const { default: timeEntryRoutes } = await import("./timeEntryRoutes");
const app = timeEntryRoutes;

describe("timeEntryRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a time entry", async () => {
    setInsertReturningData([
      { id: "te-1", bookId: "book-1", hours: "2.0000", rate: "150.0000" },
    ]);
    const res = await app.handle(
      new Request("http://localhost/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          date: "2026-03-01",
          hours: 2,
          rate: 150,
          description: "Work",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.entry).toMatchObject({ id: "te-1" });
  });

  test("rejects a bad date", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: "book-1", date: "03/01/2026" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  test("lists entries for a book", async () => {
    setSelectResults([[{ id: "te-1" }, { id: "te-2" }]]);
    const res = await app.handle(
      new Request("http://localhost/api/time-entries?bookId=book-1"),
    );
    const data = await res.json();
    expect(data.entries).toHaveLength(2);
  });
});
