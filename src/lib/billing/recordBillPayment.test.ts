import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedPayment: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let billUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  if (values.billId !== undefined && values.paymentAccountId !== undefined) {
    insertedPayment = values;
    return { returning: mock(() => [{ id: "pay-1" }]) };
  }
  insertedLines.push(values);
  return {};
});

const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.status !== undefined) billUpdate = values;
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

const { recordBillPayment } = await import("./recordBillPayment");

const openBill = {
  id: "bill-1",
  bookId: "book-1",
  vendorId: "vendor-1",
  number: "B-1",
  status: "open",
  total: "100",
  amountPaid: "0",
};

const base = {
  billId: "bill-1",
  bookId: "book-1",
  paymentAccountId: "cash",
  date: "2026-09-10",
};

beforeEach(() => {
  resetDbMock();
  insertedPayment = null;
  insertedLines.length = 0;
  billUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  mockTransaction.mockClear();
});

describe("recordBillPayment", () => {
  test("posts DR AP / CR payment account and marks the bill paid", async () => {
    setSelectResults([[openBill], [{ id: "cash" }], [{ id: "ap" }]]);

    const result = await recordBillPayment({ ...base, amount: 100 });

    expect(insertedPayment).toMatchObject({
      billId: "bill-1",
      amount: "100.0000",
      paymentAccountId: "cash",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "entry-1",
        accountId: "ap",
        debit: "100.0000",
        credit: "0.0000",
      },
      {
        journalEntryId: "entry-1",
        accountId: "cash",
        debit: "0.0000",
        credit: "100.0000",
      },
    ]);
    expect(billUpdate).toMatchObject({
      amountPaid: "100.0000",
      status: "paid",
    });
    expect(result).toMatchObject({ billStatus: "paid", amountPaid: 100 });
  });

  test("rejects overpayment", async () => {
    setSelectResults([[openBill], [{ id: "cash" }], [{ id: "ap" }]]);
    await expect(recordBillPayment({ ...base, amount: 150 })).rejects.toThrow(
      /exceeds the balance/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a cross-book bill (IDOR)", async () => {
    setSelectResults([[{ ...openBill, bookId: "other" }]]);
    await expect(recordBillPayment({ ...base, amount: 10 })).rejects.toThrow(
      /not found/,
    );
  });
});
