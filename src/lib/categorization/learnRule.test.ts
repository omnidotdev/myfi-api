import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  mockUpdateWhere,
  resetDbMock,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: learnRule } = await import("./learnRule");

describe("learnRule", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("creates new rule when none exists", async () => {
    setSelectResults([[]]);
    await learnRule("book-1", "Spotify", "debit-1", "credit-1");
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const insertArg = (
      mockInsertValues.mock.calls[0] as unknown[]
    )[0] as Record<string, unknown>;
    expect(insertArg.bookId).toBe("book-1");
    expect(insertArg.matchValue).toBe("spotify");
    expect(insertArg.matchField).toBe("merchant_name");
    expect(insertArg.matchType).toBe("exact");
    expect(insertArg.debitAccountId).toBe("debit-1");
    expect(insertArg.creditAccountId).toBe("credit-1");
    expect(insertArg.name).toBe("Auto: spotify");
  });

  test("updates existing rule", async () => {
    setSelectResults([[{ id: "existing-rule-1" }]]);
    await learnRule("book-1", "Spotify", "debit-2", "credit-2");
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("normalizes merchant name to lowercase and trimmed", async () => {
    setSelectResults([[]]);
    await learnRule("book-1", "  SPOTIFY  ", "debit-1", "credit-1");
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    const insertArg = (
      mockInsertValues.mock.calls[0] as unknown[]
    )[0] as Record<string, unknown>;
    expect(insertArg.matchValue).toBe("spotify");
  });

  test("skips empty merchant name", async () => {
    await learnRule("book-1", "   ", "debit-1", "credit-1");
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
