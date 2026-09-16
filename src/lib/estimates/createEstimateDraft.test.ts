import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool } from "lib/test/mockDb";

let insertedEstimate: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.customerId !== undefined) {
    insertedEstimate = values;
    return { returning: mock(() => [{ id: "est-1" }]) };
  }
  insertedLines.push(values);
  return {};
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = { insert: mock(() => ({ values: txInsertValues })) };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { createEstimateDraft } = await import("./createEstimateDraft");

const base = {
  bookId: "book-1",
  customerId: "cust-1",
  number: "Q-1",
  estimateDate: "2026-09-01",
};

beforeEach(() => {
  insertedEstimate = null;
  insertedLines.length = 0;
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("createEstimateDraft", () => {
  test("creates a draft estimate with computed subtotal and lines", async () => {
    const result = await createEstimateDraft({
      ...base,
      lines: [
        {
          description: "Phase 1",
          quantity: 1,
          unitPrice: 5000,
          incomeAccountId: "sales",
        },
        {
          description: "Phase 2",
          quantity: 2,
          unitPrice: 1000,
          incomeAccountId: "sales",
        },
      ],
    });

    expect(insertedEstimate).toMatchObject({
      customerId: "cust-1",
      status: "draft",
      subtotal: "7000.0000",
      total: "7000.0000",
    });
    expect(insertedLines).toHaveLength(2);
    expect(result).toEqual({
      estimateId: "est-1",
      number: "Q-1",
      subtotal: 7000,
      lineCount: 2,
    });
  });

  test("throws when there are no lines", async () => {
    await expect(createEstimateDraft({ ...base, lines: [] })).rejects.toThrow(
      /at least one line/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
