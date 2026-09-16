import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedTxn: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let itemUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  if (values.type !== undefined) {
    insertedTxn = values;
    return { returning: mock(() => [{ id: "txn-1" }]) };
  }
  insertedLines.push(values);
  return {};
});

const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.quantityOnHand !== undefined) itemUpdate = values;
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

const { recordInventorySale } = await import("./recordInventorySale");

const item = {
  id: "item-1",
  bookId: "book-1",
  name: "Widget",
  quantityOnHand: "20",
  averageCost: "3",
  assetAccountId: "asset",
  cogsAccountId: "cogs",
};

const base = { itemId: "item-1", bookId: "book-1", date: "2026-09-10" };

beforeEach(() => {
  resetDbMock();
  insertedTxn = null;
  insertedLines.length = 0;
  itemUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("recordInventorySale", () => {
  test("debits COGS, credits inventory asset at average cost, reduces stock", async () => {
    setSelectResults([[item]]);

    const result = await recordInventorySale({ ...base, quantity: 5 });

    // 5 @ avg $3 = $15
    expect(insertedTxn).toMatchObject({
      type: "sale",
      quantity: "-5.0000",
      unitCost: "3.0000",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "entry-1",
        accountId: "cogs",
        debit: "15.0000",
        credit: "0.0000",
      },
      {
        journalEntryId: "entry-1",
        accountId: "asset",
        debit: "0.0000",
        credit: "15.0000",
      },
    ]);
    expect(itemUpdate).toMatchObject({ quantityOnHand: "15.0000" });
    expect(result).toMatchObject({ cogs: 15, quantityOnHand: 15 });
  });

  test("rejects overselling", async () => {
    setSelectResults([[item]]);
    await expect(
      recordInventorySale({ ...base, quantity: 25 }),
    ).rejects.toThrow(/enough stock/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a cross-book item (IDOR)", async () => {
    setSelectResults([[{ ...item, bookId: "other" }]]);
    await expect(recordInventorySale({ ...base, quantity: 1 })).rejects.toThrow(
      /not found/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
