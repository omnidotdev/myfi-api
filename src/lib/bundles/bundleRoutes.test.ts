import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Only list and the empty-components rejection are exercised here; neither calls
// authorizeBook, so this file does not mock bookAccess.middleware (mocking it
// globally leaks into the middleware's own integration test)

const { default: bundleRoutes } = await import("./bundleRoutes");
const app = bundleRoutes;

describe("bundleRoutes", () => {
  beforeEach(() => resetDbMock());

  test("lists no bundles for an empty book", async () => {
    setSelectResults([[]]);
    const res = await app.handle(
      new Request("http://localhost/api/bundles?bookId=book-1"),
    );
    const data = await res.json();
    expect(data.bundles).toEqual([]);
  });

  test("rejects a bundle with no components", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Empty",
          components: [],
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
