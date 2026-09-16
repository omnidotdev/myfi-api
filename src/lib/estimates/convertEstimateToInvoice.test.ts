import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Run the real createInvoiceDraft against a mocked transaction (mocking the
// createInvoiceDraft module itself would leak globally into its own test file)
const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.customerId !== undefined) {
    return { returning: mock(() => [{ id: "inv-1" }]) };
  }
  return {};
});
const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = { insert: mock(() => ({ values: txInsertValues })) };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { convertEstimateToInvoice } = await import("./convertEstimateToInvoice");

const acceptedEstimate = {
  id: "est-1",
  bookId: "book-1",
  customerId: "cust-1",
  status: "accepted",
  memo: null,
  convertedInvoiceId: null,
};

const opts = {
  estimateId: "est-1",
  bookId: "book-1",
  invoiceNumber: "1001",
  issueDate: "2026-09-01",
  dueDate: "2026-10-01",
};

beforeEach(() => {
  resetDbMock();
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("convertEstimateToInvoice", () => {
  test("creates a draft invoice from the estimate lines and marks it converted", async () => {
    setSelectResults([
      [acceptedEstimate],
      [
        {
          description: "Work",
          quantity: "1",
          unitPrice: "100",
          incomeAccountId: "sales",
          taxJurisdictionId: null,
        },
      ],
    ]);

    const result = await convertEstimateToInvoice(opts);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      estimateId: "est-1",
      invoiceId: "inv-1",
      alreadyConverted: false,
    });
  });

  test("is idempotent for an already-converted estimate", async () => {
    setSelectResults([
      [
        {
          ...acceptedEstimate,
          status: "converted",
          convertedInvoiceId: "inv-9",
        },
      ],
    ]);

    const result = await convertEstimateToInvoice(opts);

    expect(result).toEqual({
      estimateId: "est-1",
      invoiceId: "inv-9",
      alreadyConverted: true,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("refuses to convert a declined estimate", async () => {
    setSelectResults([[{ ...acceptedEstimate, status: "declined" }]]);
    await expect(convertEstimateToInvoice(opts)).rejects.toThrow(/declined/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a cross-book estimate (IDOR)", async () => {
    setSelectResults([[{ ...acceptedEstimate, bookId: "other" }]]);
    await expect(convertEstimateToInvoice(opts)).rejects.toThrow(/not found/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
