import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedEntry: Record<string, unknown> | null = null;
let insertedLines: Array<Record<string, unknown>> = [];
let billUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: unknown) => {
  if (Array.isArray(values)) {
    insertedLines = values as Array<Record<string, unknown>>;
    return {};
  }
  insertedEntry = values as Record<string, unknown>;
  return { returning: mock(() => [{ id: "reversal-1" }]) };
});
const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  billUpdate = values;
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

const { voidBill } = await import("./voidBill");

const postedBill = {
  id: "bill-1",
  bookId: "book-1",
  number: "B-1",
  vendorId: "vendor-1",
  status: "open",
  journalEntryId: "entry-1",
};

beforeEach(() => {
  resetDbMock();
  insertedEntry = null;
  insertedLines = [];
  billUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("voidBill", () => {
  test("posts a reversing entry (not a delete) and marks a posted bill void", async () => {
    setSelectResults([
      [postedBill], // bill
      [], // payments
      [], // isPeriodLocked: open period
      [
        { accountId: "expense", debit: "100.0000", credit: "0.0000" },
        { accountId: "ap", debit: "0.0000", credit: "100.0000" },
      ], // original lines
    ]);
    const result = await voidBill("bill-1", "book-1");
    expect(insertedEntry).toMatchObject({
      source: "bill_void",
      sourceReferenceId: "bill-1",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "reversal-1",
        accountId: "expense",
        debit: "0.0000",
        credit: "100.0000",
      },
      {
        journalEntryId: "reversal-1",
        accountId: "ap",
        debit: "100.0000",
        credit: "0.0000",
      },
    ]);
    expect(billUpdate).toMatchObject({ status: "void" });
    expect(result).toEqual({ billId: "bill-1", alreadyVoid: false });
  });

  test("refuses to reverse into a closed period", async () => {
    setSelectResults([[postedBill], [], [{ status: "closed" }]]);
    await expect(voidBill("bill-1", "book-1")).rejects.toThrow(/closed period/);
    expect(mockTransaction).not.toHaveBeenCalled();
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
