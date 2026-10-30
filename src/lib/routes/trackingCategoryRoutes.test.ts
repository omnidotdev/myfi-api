import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Grant book access so the per-handler authorizeBook guards pass; the access
// control itself is covered by the middleware's own mounted integration test
import * as bookAccessMiddlewareModule from "lib/middleware/bookAccess.middleware";

// Spread the real module so only authorizeBook is overridden: a partial mock
// here leaks (bun mock.module is process-global) and strips the default
// middleware export, breaking the middleware's own mounted integration test
mock.module("lib/middleware/bookAccess.middleware", () => ({
  ...bookAccessMiddlewareModule,
  authorizeBook: mock(async () => ({ userId: "user-1" })),
}));

const { default: trackingCategoryRoutes } = await import(
  "./trackingCategoryRoutes"
);
const app = trackingCategoryRoutes;

const post = (path: string, body: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("trackingCategoryRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a class category", async () => {
    setInsertReturningData([
      { id: "tc-1", bookId: "book-1", kind: "class", name: "Admin" },
    ]);
    const res = await post("/api/tracking-categories", {
      bookId: "book-1",
      kind: "class",
      name: "Admin",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.category).toMatchObject({ kind: "class", name: "Admin" });
  });

  test("rejects an unknown kind", async () => {
    const res = await post("/api/tracking-categories", {
      bookId: "book-1",
      kind: "department",
      name: "Oops",
    });
    expect(res.status).toBe(400);
  });

  test("lists categories for a book", async () => {
    setSelectResults([
      [
        { id: "tc-1", bookId: "book-1", kind: "location", name: "East" },
        { id: "tc-2", bookId: "book-1", kind: "location", name: "West" },
      ],
    ]);
    const res = await app.handle(
      new Request(
        "http://localhost/api/tracking-categories?bookId=book-1&kind=location",
      ),
    );
    const data = await res.json();
    expect(data.categories).toHaveLength(2);
  });

  // The happy-path assignment (the journal_line_tracking_category insert and
  // its effect on reporting) is exercised against real Postgres in
  // profitAndLossTrackingCategory.test.ts; here we assert the tenancy guard
  test("rejects assignments spanning two books", async () => {
    setSelectResults([
      [{ id: "tc-1", bookId: "book-1" }],
      [{ id: "jl-1", bookId: "book-2" }],
    ]);
    const res = await post("/api/tracking-categories/line-assignments", {
      assignments: [{ journalLineId: "jl-1", trackingCategoryId: "tc-1" }],
    });
    expect(res.status).toBe(400);
  });
});
