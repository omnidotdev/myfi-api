import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool } from "lib/test/mockDb";

let insertedBill: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.vendorId !== undefined) {
    insertedBill = values;
    return { returning: mock(() => [{ id: "bill-1" }]) };
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

const { createBillDraft } = await import("./createBillDraft");

const base = {
  bookId: "book-1",
  vendorId: "vendor-1",
  number: "B-1",
  billDate: "2026-09-01",
  dueDate: "2026-10-01",
};

beforeEach(() => {
  insertedBill = null;
  insertedLines.length = 0;
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("createBillDraft", () => {
  test("creates a draft bill with computed line amounts and subtotal", async () => {
    const result = await createBillDraft({
      ...base,
      lines: [
        {
          description: "Rent",
          quantity: 1,
          unitPrice: 1200,
          expenseAccountId: "rent",
        },
        {
          description: "Supplies",
          quantity: 3,
          unitPrice: 10,
          expenseAccountId: "supplies",
        },
      ],
    });

    expect(insertedBill).toMatchObject({
      vendorId: "vendor-1",
      status: "draft",
      subtotal: "1230.0000",
      total: "1230.0000",
    });
    expect(insertedLines).toHaveLength(2);
    expect(result).toEqual({
      billId: "bill-1",
      number: "B-1",
      subtotal: 1230,
      lineCount: 2,
    });
  });

  test("throws when there are no lines", async () => {
    await expect(createBillDraft({ ...base, lines: [] })).rejects.toThrow(
      /at least one line/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
