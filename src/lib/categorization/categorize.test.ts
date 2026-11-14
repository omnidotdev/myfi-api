import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Mock inferCategory (LLM calls)
const mockInferCategory = mock(
  (..._args: unknown[]): Promise<unknown> => Promise.resolve(null),
);
mock.module("./inferCategory", () => ({
  default: mockInferCategory,
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Mock the book-scoped AI runner: by default it hands the call a scoped key
type Outcome =
  | { status: "ok"; value: unknown }
  | { status: "allowance_used" }
  | { status: "unavailable" };
const mockRun = mock(
  async (
    _req: { bookId: string; mode: string },
    call: (apiKey: string) => Promise<unknown>,
  ): Promise<Outcome> => ({ status: "ok", value: await call("sk-scoped") }),
);
mock.module("lib/ai/bookAi", () => ({ default: { run: mockRun } }));

const { default: categorize } = await import("./categorize");

const baseCtx = {
  merchantName: "Test Merchant",
  memo: null,
  plaidCategory: null,
  amount: 25,
};

describe("categorize", () => {
  beforeEach(() => {
    resetDbMock();
    mockInferCategory.mockClear();
    mockRun.mockClear();
  });

  test("returns rule result when rule matches", async () => {
    // matchRule query returns a matching rule
    setSelectResults([
      [
        {
          id: "rule-1",
          bookId: "book-1",
          name: "Test",
          matchField: "merchant_name",
          matchType: "exact",
          matchValue: "test merchant",
          amountMin: null,
          amountMax: null,
          debitAccountId: "debit-1",
          creditAccountId: "credit-1",
          confidence: "0.95",
          priority: 10,
          hitCount: 0,
          lastHitAt: null,
        },
      ],
    ]);

    const result = await categorize(baseCtx, "book-1", "personal");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("rule");
    expect(result!.ruleId).toBe("rule-1");
    expect(result!.debitAccountId).toBe("debit-1");
    expect(result!.confidence).toBe(0.95);
  });

  test("falls back to LLM when no rule matches", async () => {
    // First select: matchRule returns no rules
    // Second select: account lookup for LLM
    setSelectResults([
      [],
      [
        { id: "acct-1", name: "Groceries", code: "5010", type: "expense" },
        { id: "acct-2", name: "Checking", code: "1010", type: "asset" },
      ],
    ]);

    mockInferCategory.mockResolvedValueOnce({
      debitAccountId: "acct-1",
      creditAccountId: "acct-2",
      confidence: 0.88,
      reasoning: "Common grocery store",
    });

    const result = await categorize(baseCtx, "book-1", "personal");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("llm");
    expect(result!.debitAccountId).toBe("acct-1");
    expect(result!.reasoning).toBe("Common grocery store");
  });

  test("returns null when both rule and LLM fail", async () => {
    setSelectResults([[], []]);
    mockInferCategory.mockResolvedValueOnce(null);

    const result = await categorize(baseCtx, "book-1", "personal");
    expect(result).toBeNull();
  });

  test("does not call LLM when rule matches", async () => {
    setSelectResults([
      [
        {
          id: "rule-1",
          bookId: "book-1",
          name: "Test",
          matchField: "merchant_name",
          matchType: "exact",
          matchValue: "test merchant",
          amountMin: null,
          amountMax: null,
          debitAccountId: "debit-1",
          creditAccountId: "credit-1",
          confidence: "0.95",
          priority: 10,
          hitCount: 0,
          lastHitAt: null,
        },
      ],
    ]);

    await categorize(baseCtx, "book-1", "personal");
    expect(mockInferCategory).not.toHaveBeenCalled();
  });

  test("runs the LLM as bulk work for the book with the scoped key", async () => {
    setSelectResults([[], [{ id: "a", name: "A", code: "1", type: "asset" }]]);

    await categorize(baseCtx, "book-1", "personal");

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun.mock.calls[0]?.[0]).toEqual({
      bookId: "book-1",
      mode: "bulk",
    });
    expect(mockInferCategory.mock.calls[0]?.[1]).toBe("sk-scoped");
  });

  test("uses rules only (no error) once the included AI allowance is used", async () => {
    setSelectResults([[], [{ id: "a", name: "A", code: "1", type: "asset" }]]);
    mockRun.mockResolvedValueOnce({ status: "allowance_used" });

    const result = await categorize(baseCtx, "book-1", "personal");

    expect(result).toBeNull();
    expect(mockInferCategory).not.toHaveBeenCalled();
  });

  test("uses rules only when AI is unavailable", async () => {
    setSelectResults([[], [{ id: "a", name: "A", code: "1", type: "asset" }]]);
    mockRun.mockResolvedValueOnce({ status: "unavailable" });

    const result = await categorize(baseCtx, "book-1", "personal");

    expect(result).toBeNull();
  });
});
