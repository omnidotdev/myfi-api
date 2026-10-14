import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Exercises voidInvoice returning inventory to stock (via offsetting movements)
// when the voided invoice had sold items
let itemUpdate: Record<string, unknown> | null = null;
let invoiceUpdate: Record<string, unknown> | null = null;
let insertedInventory: Array<Record<string, unknown>> | null = null;

const txInsertValues = mock((values: unknown) => {
  if (Array.isArray(values)) {
    const arr = values as Array<Record<string, unknown>>;
    // Inventory movement rows carry itemId; journal lines do not
    if (arr[0]?.itemId !== undefined) insertedInventory = arr;
    return {};
  }
  return { returning: mock(() => [{ id: "reversal-1" }]) };
});
const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.status !== undefined) invoiceUpdate = values;
  else if (values.quantityOnHand !== undefined) itemUpdate = values;
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
  itemUpdate = null;
  invoiceUpdate = null;
  insertedInventory = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidInvoice restock", () => {
  test("returns sold inventory to stock with an offsetting movement", async () => {
    setSelectResults([
      [postedInvoice], // invoice
      [], // payments
      [], // isPeriodLocked: open period
      [{ accountId: "ar", debit: "100.0000", credit: "0.0000" }], // orig lines
      [{ itemId: "item-1", quantity: "-2", unitCost: "5", date: "2026-01-01" }], // movements
      [{ id: "item-1", quantityOnHand: "8" }], // current item
    ]);

    const result = await voidInvoice("inv-1", "book-1");

    // 8 on hand + 2 returned = 10
    expect(itemUpdate).toMatchObject({ quantityOnHand: "10.0000" });
    // An offsetting (+2) movement is posted rather than deleting the original
    expect(insertedInventory).toEqual([
      expect.objectContaining({
        itemId: "item-1",
        quantity: "2.0000",
        journalEntryId: "reversal-1",
      }),
    ]);
    expect(invoiceUpdate).toMatchObject({ status: "void" });
    expect(result).toEqual({ invoiceId: "inv-1", alreadyVoid: false });
  });
});
