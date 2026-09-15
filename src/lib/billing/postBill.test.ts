import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let billUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    insertedEntry = values;
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  insertedLines.push(values);
  return {};
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

const { postBill } = await import("./postBill");

const draftBill = {
  id: "bill-1",
  bookId: "book-1",
  vendorId: "vendor-1",
  number: "B-1",
  status: "draft",
  billDate: "2026-09-01",
  total: "0",
  journalEntryId: null,
};

beforeEach(() => {
  resetDbMock();
  insertedEntry = null;
  insertedLines.length = 0;
  billUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("postBill", () => {
  test("posts a draft bill: expense and tax debits, AP credit, bill opened", async () => {
    setSelectResults([
      [draftBill],
      [
        {
          quantity: "1",
          unitPrice: "100",
          expenseAccountId: "supplies",
          taxRate: "0.0825",
          taxPayableAccountId: "tax",
        },
      ],
      [{ id: "ap" }],
    ]);

    const result = await postBill("bill-1", "book-1");

    expect(insertedEntry).toMatchObject({
      bookId: "book-1",
      source: "bill",
      sourceReferenceId: "bill-1",
      vendorId: "vendor-1",
      memo: "Bill B-1",
    });
    // supplies debit + tax debit + AP credit
    expect(insertedLines).toHaveLength(3);
    expect(insertedLines.find((l) => l.accountId === "ap")).toMatchObject({
      credit: "108.2500",
      debit: "0.0000",
    });
    expect(insertedLines.find((l) => l.accountId === "supplies")).toMatchObject(
      {
        debit: "100.0000",
      },
    );
    expect(billUpdate).toMatchObject({ status: "open", total: "108.2500" });
    expect(result).toMatchObject({ total: 108.25, alreadyPosted: false });
  });

  test("is idempotent for an already-posted bill", async () => {
    setSelectResults([
      [{ ...draftBill, status: "open", journalEntryId: "e9", total: "100" }],
    ]);
    const result = await postBill("bill-1", "book-1");
    expect(result).toEqual({
      billId: "bill-1",
      journalEntryId: "e9",
      total: 100,
      alreadyPosted: true,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("throws when the book has no Accounts Payable account", async () => {
    setSelectResults([
      [draftBill],
      [
        {
          quantity: "1",
          unitPrice: "10",
          expenseAccountId: "supplies",
          taxRate: null,
          taxPayableAccountId: null,
        },
      ],
      [],
    ]);
    await expect(postBill("bill-1", "book-1")).rejects.toThrow(
      /Accounts Payable/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("throws on a cross-book bill (IDOR)", async () => {
    setSelectResults([[{ ...draftBill, bookId: "other" }]]);
    await expect(postBill("bill-1", "book-1")).rejects.toThrow(/not found/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
