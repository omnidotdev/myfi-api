import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedTxn: Record<string, unknown> | null = null;
let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let itemUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    insertedEntry = values;
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

const { receiveStock } = await import("./receiveStock");

const item = {
  id: "item-1",
  bookId: "book-1",
  name: "Widget",
  quantityOnHand: "10",
  averageCost: "2",
  assetAccountId: "asset",
};

const base = {
  itemId: "item-1",
  bookId: "book-1",
  date: "2026-09-01",
  sourceAccountId: "cash",
};

beforeEach(() => {
  resetDbMock();
  insertedTxn = null;
  insertedEntry = null;
  insertedLines.length = 0;
  itemUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("receiveStock", () => {
  test("debits inventory asset, credits source, and rolls average cost", async () => {
    setSelectResults([[item], [{ id: "cash" }]]);

    const result = await receiveStock({ ...base, quantity: 10, unitCost: 4 });

    expect(insertedTxn).toMatchObject({
      type: "receipt",
      quantity: "10.0000",
      unitCost: "4.0000",
    });
    expect(insertedEntry).toMatchObject({
      source: "inventory_receipt",
      sourceReferenceId: "txn-1",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "entry-1",
        accountId: "asset",
        debit: "40.0000",
        credit: "0.0000",
      },
      {
        journalEntryId: "entry-1",
        accountId: "cash",
        debit: "0.0000",
        credit: "40.0000",
      },
    ]);
    // 10 @ $2 + 10 @ $4 => 20 @ $3
    expect(itemUpdate).toMatchObject({
      quantityOnHand: "20.0000",
      averageCost: "3.0000",
    });
    expect(result).toMatchObject({ quantityOnHand: 20, averageCost: 3 });
  });

  test("rejects a non-positive quantity", async () => {
    await expect(
      receiveStock({ ...base, quantity: 0, unitCost: 4 }),
    ).rejects.toThrow(/must be positive/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a cross-book item (IDOR)", async () => {
    setSelectResults([[{ ...item, bookId: "other" }]]);
    await expect(
      receiveStock({ ...base, quantity: 1, unitCost: 4 }),
    ).rejects.toThrow(/not found/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a source account not in the book", async () => {
    setSelectResults([[item], []]);
    await expect(
      receiveStock({ ...base, quantity: 1, unitCost: 4 }),
    ).rejects.toThrow(/Source account/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
