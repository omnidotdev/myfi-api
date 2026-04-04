import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: matchRule } = await import("./matchRule");

const makeRule = (overrides: Record<string, unknown> = {}) => ({
  id: "rule-1",
  bookId: "book-1",
  name: "Test Rule",
  matchField: "merchant_name",
  matchType: "exact",
  matchValue: "spotify",
  amountMin: null,
  amountMax: null,
  debitAccountId: "debit-1",
  creditAccountId: "credit-1",
  confidence: "0.95",
  priority: 10,
  hitCount: 0,
  lastHitAt: null,
  createdAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("matchRule", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("returns null when no rules exist", async () => {
    setSelectResults([[]]);
    const result = await matchRule(
      { merchantName: "Spotify", memo: null, plaidCategory: null, amount: 10 },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("matches exact merchant name (case insensitive)", async () => {
    setSelectResults([[makeRule()]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).toEqual({
      debitAccountId: "debit-1",
      creditAccountId: "credit-1",
      confidence: 0.95,
      ruleId: "rule-1",
    });
  });

  test("matches contains pattern", async () => {
    setSelectResults([
      [makeRule({ matchType: "contains", matchValue: "amazon" })],
    ]);
    const result = await matchRule(
      {
        merchantName: "AMAZON MARKETPLACE",
        memo: null,
        plaidCategory: null,
        amount: 50,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
    expect(result!.debitAccountId).toBe("debit-1");
  });

  test("matches starts_with pattern", async () => {
    setSelectResults([
      [makeRule({ matchType: "starts_with", matchValue: "uber" })],
    ]);
    const result = await matchRule(
      {
        merchantName: "UBER EATS",
        memo: null,
        plaidCategory: null,
        amount: 25,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
  });

  test("matches regex pattern", async () => {
    setSelectResults([
      [makeRule({ matchType: "regex", matchValue: "^(uber|lyft)" })],
    ]);
    const result = await matchRule(
      {
        merchantName: "Uber Eats",
        memo: null,
        plaidCategory: null,
        amount: 15,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
  });

  test("skips rules below confidence threshold", async () => {
    setSelectResults([[makeRule({ confidence: "0.50" })]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("respects amount range (below min)", async () => {
    setSelectResults([[makeRule({ amountMin: "10", amountMax: "100" })]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 5,
      },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("respects amount range (above max)", async () => {
    setSelectResults([[makeRule({ amountMin: "10", amountMax: "100" })]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 150,
      },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("matches when amount within range", async () => {
    setSelectResults([[makeRule({ amountMin: "10", amountMax: "100" })]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 50,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
  });

  test("returns first match by priority order", async () => {
    setSelectResults([
      [
        makeRule({
          id: "rule-high",
          priority: 20,
          debitAccountId: "debit-high",
        }),
        makeRule({
          id: "rule-low",
          priority: 10,
          debitAccountId: "debit-low",
        }),
      ],
    ]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe("rule-high");
    expect(result!.debitAccountId).toBe("debit-high");
  });

  test("skips rule with unknown matchField", async () => {
    setSelectResults([[makeRule({ matchField: "unknown_field" })]]);
    const result = await matchRule(
      {
        merchantName: "Spotify",
        memo: null,
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("skips rule when field value is null", async () => {
    setSelectResults([[makeRule()]]);
    const result = await matchRule(
      {
        merchantName: null,
        memo: null,
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).toBeNull();
  });

  test("matches on memo field", async () => {
    setSelectResults([
      [
        makeRule({
          matchField: "memo",
          matchType: "contains",
          matchValue: "subscription",
        }),
      ],
    ]);
    const result = await matchRule(
      {
        merchantName: null,
        memo: "Monthly Subscription Payment",
        plaidCategory: null,
        amount: 10,
      },
      "book-1",
      0.85,
    );
    expect(result).not.toBeNull();
  });
});
