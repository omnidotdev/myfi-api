import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let deletedEntryId: unknown = null;
let invoiceUpdate: Record<string, unknown> | null = null;

const txDeleteWhere = mock((_cond: unknown) => {
  deletedEntryId = "deleted";
  return {};
});
const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  invoiceUpdate = values;
  return { where: txUpdateWhere };
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    delete: mock(() => ({ where: txDeleteWhere })),
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
  status: "open",
  journalEntryId: "entry-1",
};

beforeEach(() => {
  resetDbMock();
  deletedEntryId = null;
  invoiceUpdate = null;
  txDeleteWhere.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidInvoice", () => {
  test("deletes the journal entry and marks a posted invoice void", async () => {
    setSelectResults([[postedInvoice], []]);

    const result = await voidInvoice("inv-1", "book-1");

    expect(deletedEntryId).toBe("deleted");
    expect(invoiceUpdate).toMatchObject({
      status: "void",
      journalEntryId: null,
    });
    expect(result).toEqual({ invoiceId: "inv-1", alreadyVoid: false });
  });

  test("voids a draft invoice with no ledger change", async () => {
    setSelectResults([
      [{ ...postedInvoice, status: "draft", journalEntryId: null }],
      [],
    ]);

    await voidInvoice("inv-1", "book-1");

    expect(deletedEntryId).toBeNull();
    expect(invoiceUpdate).toMatchObject({ status: "void" });
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
