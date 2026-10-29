import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Note: only create/list are exercised here; neither calls authorizeBook (they
// carry bookId and are guarded by the global middleware), so this file does not
// mock bookAccess.middleware - mocking it globally leaks into the middleware's
// own integration test (bun mock.module is process-global)

const { default: priceLevelRoutes } = await import("./priceLevelRoutes");
const app = priceLevelRoutes;

describe("priceLevelRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a price level", async () => {
    setInsertReturningData([
      {
        id: "pl-1",
        bookId: "book-1",
        name: "Wholesale",
        adjustmentPercent: "-10.0000",
      },
    ]);
    const res = await app.handle(
      new Request("http://localhost/api/price-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Wholesale",
          adjustmentPercent: -10,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.priceLevel).toMatchObject({ name: "Wholesale" });
  });

  test("lists price levels", async () => {
    setSelectResults([[{ id: "pl-1", name: "Wholesale" }]]);
    const res = await app.handle(
      new Request("http://localhost/api/price-levels?bookId=book-1"),
    );
    const data = await res.json();
    expect(data.priceLevels).toHaveLength(1);
  });
});
