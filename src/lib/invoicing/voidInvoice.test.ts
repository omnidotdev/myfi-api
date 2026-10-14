import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedEntry: Record<string, unknown> | null = null;
let insertedLines: Array<Record<string, unknown>> = [];
let invoiceUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: unknown) => {
  if (Array.isArray(values)) {
    insertedLines = values as Array<Record<string, unknown>>;
    return {};
  }
  const v = values as Record<string, unknown>;
  if (v.source !== undefined) {
    insertedEntry = v;
    return { returning: mock(() => [{ id: "reversal-1" }]) };
  }
  return {};
});

const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.status !== undefined) invoiceUpdate = values;
  return { where: txUpdateWhere };
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock(() => ({ values: txInsertValues })),
    update: mock(() => ({ set: txUpdateSet })),
  };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { voidInvoice } = await import("./voidInvoice");

const postedInvoice = {
  id: "inv-1",
  bookId: "book-1",
  number: "1001",
  status: "open",
  journalEntryId: "entry-1",
};

beforeEach(() => {
  resetDbMock();
  insertedEntry = null;
  insertedLines = [];
  invoiceUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidInvoice", () => {
  test("posts a reversing entry (not a delete) and marks a posted invoice void", async () => {
    setSelectResults([
      [postedInvoice], // invoice
      [], // payments (none)
      [], // isPeriodLocked: no closed period
      [
        { accountId: "ar", debit: "100.0000", credit: "0.0000" },
        { accountId: "revenue", debit: "0.0000", credit: "100.0000" },
      ], // original journal lines
      [], // inventory movements (none)
    ]);

    const result = await voidInvoice("inv-1", "book-1");

    expect(insertedEntry).toMatchObject({
      source: "invoice_void",
      sourceReferenceId: "inv-1",
    });
    // Each line's debit and credit are swapped to reverse the original posting
    expect(insertedLines).toEqual([
      {
        journalEntryId: "reversal-1",
        accountId: "ar",
        debit: "0.0000",
        credit: "100.0000",
      },
      {
        journalEntryId: "reversal-1",
        accountId: "revenue",
        debit: "100.0000",
        credit: "0.0000",
      },
    ]);
    expect(invoiceUpdate).toMatchObject({ status: "void" });
    expect(result).toEqual({ invoiceId: "inv-1", alreadyVoid: false });
  });

  test("refuses to reverse into a closed period", async () => {
    setSelectResults([
      [postedInvoice],
      [],
      [{ status: "closed" }], // isPeriodLocked: today's period is closed
    ]);
    await expect(voidInvoice("inv-1", "book-1")).rejects.toThrow(
      /closed period/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("voids a draft invoice with no ledger change", async () => {
    setSelectResults([
      [{ ...postedInvoice, status: "draft", journalEntryId: null }],
      [],
    ]);

    await voidInvoice("inv-1", "book-1");

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(insertedEntry).toBeNull();
  });

  test("refuses to void an invoice with payments", async () => {
    setSelectResults([[postedInvoice], [{ id: "pay-1" }]]);
    await expect(voidInvoice("inv-1", "book-1")).rejects.toThrow(/payments/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("is a no-op on an already-void invoice", async () => {
    setSelectResults([[{ ...postedInvoice, status: "void" }]]);
    const result = await voidInvoice("inv-1", "book-1");
    expect(result).toEqual({ invoiceId: "inv-1", alreadyVoid: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a cross-book invoice (IDOR)", async () => {
    setSelectResults([[{ ...postedInvoice, bookId: "other" }]]);
    await expect(voidInvoice("inv-1", "book-1")).rejects.toThrow(/not found/);
  });
});
