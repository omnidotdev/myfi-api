import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool } from "lib/test/mockDb";

let insertedInvoice: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.customerId !== undefined) {
    insertedInvoice = values;
    return { returning: mock(() => [{ id: "inv-1" }]) };
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

const { createInvoiceDraft } = await import("./createInvoiceDraft");

const base = {
  bookId: "book-1",
  customerId: "cust-1",
  number: "1001",
  issueDate: "2026-09-01",
  dueDate: "2026-10-01",
};

beforeEach(() => {
  insertedInvoice = null;
  insertedLines.length = 0;
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("createInvoiceDraft", () => {
  test("creates a draft invoice with computed line amounts and subtotal", async () => {
    const result = await createInvoiceDraft({
      ...base,
      lines: [
        {
          description: "Design",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: "sales",
        },
        {
          description: "Hosting",
          quantity: 1,
          unitPrice: 30,
          incomeAccountId: "service",
        },
      ],
    });

    expect(insertedInvoice).toMatchObject({
      bookId: "book-1",
      customerId: "cust-1",
      number: "1001",
      status: "draft",
      subtotal: "130.0000",
      taxAmount: "0.0000",
      total: "130.0000",
    });
    expect(insertedLines).toHaveLength(2);
    expect(insertedLines[0]).toMatchObject({
      description: "Design",
      amount: "100.0000",
      sortOrder: 0,
    });
    expect(result).toEqual({
      invoiceId: "inv-1",
      number: "1001",
      subtotal: 130,
      lineCount: 2,
    });
  });

  test("throws when there are no lines", async () => {
    await expect(createInvoiceDraft({ ...base, lines: [] })).rejects.toThrow(
      /at least one line/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
