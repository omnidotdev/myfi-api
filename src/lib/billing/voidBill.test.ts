import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let deleted = false;
let billUpdate: Record<string, unknown> | null = null;

const txDeleteWhere = mock(() => {
  deleted = true;
  return {};
});
const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  billUpdate = values;
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

const { voidBill } = await import("./voidBill");

const postedBill = {
  id: "bill-1",
  bookId: "book-1",
  status: "open",
  journalEntryId: "entry-1",
};

beforeEach(() => {
  resetDbMock();
  deleted = false;
  billUpdate = null;
  txDeleteWhere.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidBill", () => {
  test("deletes the journal entry and marks a posted bill void", async () => {
    setSelectResults([[postedBill], []]);
    const result = await voidBill("bill-1", "book-1");
    expect(deleted).toBe(true);
    expect(billUpdate).toMatchObject({ status: "void", journalEntryId: null });
    expect(result).toEqual({ billId: "bill-1", alreadyVoid: false });
  });

  test("refuses to void a bill with payments", async () => {
    setSelectResults([[postedBill], [{ id: "pay-1" }]]);
    await expect(voidBill("bill-1", "book-1")).rejects.toThrow(/payments/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("is a no-op on an already-void bill", async () => {
    setSelectResults([[{ ...postedBill, status: "void" }]]);
    const result = await voidBill("bill-1", "book-1");
    expect(result).toEqual({ billId: "bill-1", alreadyVoid: true });
  });
});
