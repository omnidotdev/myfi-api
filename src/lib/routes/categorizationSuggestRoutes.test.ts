import { beforeEach, describe, expect, mock, test } from "bun:test";

import * as bookAccessMiddlewareModule from "lib/middleware/bookAccess.middleware";

const ACTOR_ID = "3f2e1d0c-9b8a-4796-a5b4-c3d2e1f0a9b8";

type Outcome =
  | { status: "ok"; value: unknown }
  | { status: "allowance_used" }
  | { status: "unavailable" };

const mockSuggest = mock(
  async (..._args: unknown[]): Promise<Outcome> => ({
    status: "ok",
    value: null,
  }),
);
mock.module("lib/categorization/suggestCategory", () => ({
  suggestCategory: mockSuggest,
}));

// Spread the real module so only authorizeBook is overridden (bun mock.module
// is process-global and a partial mock strips the default middleware export)
mock.module("lib/middleware/bookAccess.middleware", () => ({
  ...bookAccessMiddlewareModule,
  authorizeBook: mock(async () => ({ userId: ACTOR_ID })),
}));

const { default: app } = await import("./categorizationSuggestRoutes");

const body = {
  bookId: "book-1",
  description: "Staples",
  amount: 42.5,
  date: "2026-03-01",
};

const post = () =>
  app.handle(
    new Request("http://localhost/api/categorization/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/categorization/suggest", () => {
  beforeEach(() => {
    mockSuggest.mockClear();
  });

  test("suggests under the acting user for the requested book", async () => {
    const suggestion = {
      debitAccountId: "a1",
      debitAccountName: "Office Supplies",
      creditAccountId: "a2",
      creditAccountName: "Checking",
      confidence: 0.9,
      rationale: "Office purchase",
    };
    mockSuggest.mockResolvedValueOnce({ status: "ok", value: suggestion });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestion });
    expect(mockSuggest.mock.calls[0]?.[0]).toBe("book-1");
    expect(mockSuggest.mock.calls[0]?.[2]).toBe(ACTOR_ID);
  });

  test("returns the typed allowance-used state when the included AI allowance is used", async () => {
    mockSuggest.mockResolvedValueOnce({ status: "allowance_used" });

    const res = await post();

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      code: "ai_allowance_used",
      error: "AI categorization used for this period",
    });
  });

  test("returns 503 when AI is unavailable", async () => {
    mockSuggest.mockResolvedValueOnce({ status: "unavailable" });

    const res = await post();

    expect(res.status).toBe(503);
  });

  test("returns 422 when there is no confident suggestion", async () => {
    mockSuggest.mockResolvedValueOnce({ status: "ok", value: null });

    const res = await post();

    expect(res.status).toBe(422);
  });

  test("returns a generic 500 on an unexpected failure", async () => {
    mockSuggest.mockRejectedValueOnce(new Error("db down"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db down");
  });
});
