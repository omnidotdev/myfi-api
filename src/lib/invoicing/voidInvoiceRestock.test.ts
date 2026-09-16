import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Exercises voidInvoice returning inventory to stock when the voided invoice had
// sold items
let itemUpdate: Record<string, unknown> | null = null;
let invoiceUpdate: Record<string, unknown> | null = null;
let deletes = 0;

const txDeleteWhere = mock(() => {
  deletes += 1;
  return {};
});
const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.status !== undefined) invoiceUpdate = values;
  else if (values.quantityOnHand !== undefined) itemUpdate = values;
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
  itemUpdate = null;
  invoiceUpdate = null;
  deletes = 0;
  txDeleteWhere.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidInvoice restock", () => {
  test("returns sold inventory to stock and voids the invoice", async () => {
    setSelectResults([
      [postedInvoice], // invoice
      [], // payments
      [{ itemId: "item-1", quantity: "-2" }], // stock movements on the entry
      [{ id: "item-1", quantityOnHand: "8" }], // current item
    ]);

    const result = await voidInvoice("inv-1", "book-1");

    // 8 on hand + 2 returned = 10
    expect(itemUpdate).toMatchObject({ quantityOnHand: "10.0000" });
    // both the stock movements and the journal entry are deleted
    expect(deletes).toBe(2);
    expect(invoiceUpdate).toMatchObject({ status: "void" });
    expect(result).toEqual({ invoiceId: "inv-1", alreadyVoid: false });
  });
});
