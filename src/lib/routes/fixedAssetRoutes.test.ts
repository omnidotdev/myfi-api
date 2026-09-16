import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setSelectResults,
  setUpdateReturningData,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: fixedAssetRoutes } = await import("./fixedAssetRoutes");

const app = fixedAssetRoutes;

const makeAsset = (overrides: Record<string, unknown> = {}) => ({
  id: "fa-1",
  bookId: "book-1",
  name: "Delivery Van",
  description: null,
  assetAccountId: "acct-asset",
  depreciationExpenseAccountId: "acct-exp",
  accumulatedDepreciationAccountId: "acct-accum",
  acquisitionDate: "2026-01-01",
  acquisitionCost: "30000.0000",
  salvageValue: "0.0000",
  usefulLifeMonths: 60,
  depreciationMethod: "straight_line",
  macrsClass: null,
  disposedAt: null,
  disposalProceeds: null,
  createdAt: "2026-01-01",
  ...overrides,
});

const patch = (id: string, body: Record<string, unknown>) =>
  app.handle(
    new Request(`http://localhost/api/fixed-assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("PATCH /api/fixed-assets/:id", () => {
  beforeEach(() => resetDbMock());

  test("returns 404 when the asset belongs to another book", async () => {
    setSelectResults([[makeAsset()]]);

    const res = await patch("fa-1", { bookId: "other-book", name: "Renamed" });

    expect(res.status).toBe(404);
  });

  test("updates descriptive fields without touching the schedule", async () => {
    setSelectResults([[makeAsset()]]);
    setUpdateReturningData([makeAsset({ name: "Cargo Van" })]);

    const res = await patch("fa-1", { bookId: "book-1", name: "Cargo Van" });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.asset.name).toBe("Cargo Van");
  });

  test("allows editing the basis when no depreciation is posted", async () => {
    // asset lookup, then depreciation-entry lookup finds none
    setSelectResults([[makeAsset()], []]);
    setUpdateReturningData([makeAsset({ acquisitionCost: "32000.0000" })]);

    const res = await patch("fa-1", {
      bookId: "book-1",
      acquisitionCost: "32000.0000",
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.asset.acquisitionCost).toBe("32000.0000");
  });

  test("rejects a basis change once depreciation is posted", async () => {
    // asset lookup, then depreciation-entry lookup finds one
    setSelectResults([[makeAsset()], [{ id: "je-1" }]]);

    const res = await patch("fa-1", {
      bookId: "book-1",
      usefulLifeMonths: 36,
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("posted depreciation");
  });

  test("rejects a basis change on a disposed asset", async () => {
    setSelectResults([[makeAsset({ disposedAt: "2026-06-01" })]]);

    const res = await patch("fa-1", {
      bookId: "book-1",
      salvageValue: "500.0000",
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("disposed");
  });
});
