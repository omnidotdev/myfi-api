import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

const mockCategorize = mock((): Promise<unknown> => Promise.resolve(null));
mock.module("lib/categorization", () => ({
  default: mockCategorize,
  categorize: mockCategorize,
  AUTO_APPROVE_THRESHOLD: 0.9,
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { processTransaction } = await import("./processTransaction");

const baseTxn = {
  date: "2026-04-08",
  amount: 42.5,
  memo: "ACME Corp payment",
  merchantName: "ACME Corp",
  referenceId: "txn-123",
};

describe("processTransaction", () => {
  beforeEach(() => {
    resetDbMock();
    mockCategorize.mockClear();
  });

  test("creates entry with categorization when rule matches", async () => {
    // book lookup
    setSelectResults([[{ type: "business" }]]);

    mockCategorize.mockResolvedValueOnce({
      debitAccountId: "debit-1",
      creditAccountId: "credit-1",
      confidence: 0.95,
      source: "rule",
      ruleId: "rule-1",
      tagId: "tag-1",
    });

    setInsertReturningData([{ id: "entry-1" }]);

    const result = await processTransaction(baseTxn, {
      bookId: "book-1",
      source: "csv_import",
    });

    expect(result).not.toBeNull();
    expect(result!.entryId).toBe("entry-1");
    expect(result!.status).toBe("approved");
    expect(result!.priority).toBe(0);
    expect(result!.confidence).toBe(0.95);
    expect(mockCategorize).toHaveBeenCalledTimes(1);
  });

  test("creates uncategorized entry when categorization fails", async () => {
    setSelectResults([[{ type: "business" }]]);
    mockCategorize.mockResolvedValueOnce(null);
    setInsertReturningData([{ id: "entry-2" }]);

    const result = await processTransaction(baseTxn, {
      bookId: "book-1",
      source: "csv_import",
    });

    expect(result).not.toBeNull();
    expect(result!.entryId).toBe("entry-2");
    expect(result!.status).toBe("pending_review");
    expect(result!.priority).toBe(100);
    expect(result!.confidence).toBe(0);
  });

  test("sets priority 50 for low-confidence categorized transactions", async () => {
    setSelectResults([[{ type: "personal" }]]);

    mockCategorize.mockResolvedValueOnce({
      debitAccountId: "debit-1",
      creditAccountId: "credit-1",
      confidence: 0.7,
      source: "llm",
    });

    setInsertReturningData([{ id: "entry-3" }]);

    const result = await processTransaction(baseTxn, {
      bookId: "book-1",
      source: "ofx_import",
    });

    expect(result!.status).toBe("pending_review");
    expect(result!.priority).toBe(50);
  });
});
