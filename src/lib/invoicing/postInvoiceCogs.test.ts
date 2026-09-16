import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Exercises the auto-COGS path of postInvoice: an invoice line that sells an
// inventory item posts DR COGS / CR inventory-asset at average cost, records a
// stock movement, and decrements the item
let insertedTxn: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let itemUpdate: Record<string, unknown> | null = null;
let invoiceUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  if (values.type !== undefined) {
    insertedTxn = values;
    return {};
  }
  insertedLines.push(values);
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
    insert: mock(() => ({ values: txInsertValues })),
    update: mock(() => ({ set: txUpdateSet })),
  };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { postInvoice } = await import("./postInvoice");

const draftInvoice = {
  id: "inv-1",
  bookId: "book-1",
  number: "1001",
  status: "draft",
  issueDate: "2026-09-01",
  total: "0",
  journalEntryId: null,
};

beforeEach(() => {
  resetDbMock();
  insertedTxn = null;
  insertedLines.length = 0;
  itemUpdate = null;
  invoiceUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("postInvoice auto-COGS", () => {
  test("posts COGS, records the stock movement, and decrements the item", async () => {
    setSelectResults([
      [draftInvoice],
      [
        {
          quantity: "2",
          unitPrice: "50",
          incomeAccountId: "sales",
          inventoryItemId: "item-1",
          taxRate: null,
          taxPayableAccountId: null,
        },
      ],
      [{ id: "ar" }],
      [
        {
          id: "item-1",
          bookId: "book-1",
          averageCost: "3",
          quantityOnHand: "10",
          cogsAccountId: "cogs",
          assetAccountId: "asset",
        },
      ],
    ]);

    await postInvoice("inv-1", "book-1");

    // AR debit 100, sales credit 100, plus COGS 6 debit and inventory 6 credit
    const ar = insertedLines.find((l) => l.accountId === "ar");
    expect(ar).toMatchObject({ debit: "100.0000" });
    expect(insertedLines.find((l) => l.accountId === "cogs")).toMatchObject({
      debit: "6.0000",
      credit: "0.0000",
    });
    expect(insertedLines.find((l) => l.accountId === "asset")).toMatchObject({
      debit: "0.0000",
      credit: "6.0000",
    });
    // one stock movement (sale of 2 at avg cost 3)
    expect(insertedTxn).toMatchObject({
      type: "sale",
      quantity: "-2.0000",
      unitCost: "3.0000",
    });
    // item decremented 10 -> 8
    expect(itemUpdate).toMatchObject({ quantityOnHand: "8.0000" });
    expect(invoiceUpdate).toMatchObject({ status: "open" });
  });

  test("throws when a line references an item from another book", async () => {
    setSelectResults([
      [draftInvoice],
      [
        {
          quantity: "1",
          unitPrice: "50",
          incomeAccountId: "sales",
          inventoryItemId: "item-x",
          taxRate: null,
          taxPayableAccountId: null,
        },
      ],
      [{ id: "ar" }],
      [
        {
          id: "item-x",
          bookId: "other-book",
          averageCost: "3",
          quantityOnHand: "10",
          cogsAccountId: "c",
          assetAccountId: "a",
        },
      ],
    ]);

    await expect(postInvoice("inv-1", "book-1")).rejects.toThrow(
      /not in this book/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
