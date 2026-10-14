import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedPayment: Record<string, unknown> | null = null;
let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let invoiceUpdate: Record<string, unknown> | null = null;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    insertedEntry = values;
    return { returning: mock(() => [{ id: "entry-1" }]) };
  }
  if (values.invoiceId !== undefined && values.depositAccountId !== undefined) {
    insertedPayment = values;
    return { returning: mock(() => [{ id: "pay-1" }]) };
  }
  insertedLines.push(values);
  return {};
});

const txUpdateWhere = mock(() => ({}));
const txUpdateSet = mock((values: Record<string, unknown>) => {
  if (values.status !== undefined) invoiceUpdate = values;
  return { where: txUpdateWhere };
});

// The invoice returned by the in-transaction FOR UPDATE re-read
let lockedInvoice: Record<string, unknown> | null = null;
const txSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      for: mock(() => (lockedInvoice ? [lockedInvoice] : [])),
    })),
  })),
}));

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    select: txSelect,
    insert: mock(() => ({ values: txInsertValues })),
    update: mock(() => ({ set: txUpdateSet })),
  };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { recordInvoicePayment } = await import("./recordInvoicePayment");

const openInvoice = {
  id: "inv-1",
  bookId: "book-1",
  number: "1001",
  status: "open",
  total: "100",
  amountPaid: "0",
};

const base = {
  invoiceId: "inv-1",
  bookId: "book-1",
  depositAccountId: "cash",
  date: "2026-09-10",
};

beforeEach(() => {
  resetDbMock();
  insertedPayment = null;
  insertedEntry = null;
  insertedLines.length = 0;
  invoiceUpdate = null;
  lockedInvoice = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  txSelect.mockClear();
  mockTransaction.mockClear();
});

describe("recordInvoicePayment", () => {
  test("posts DR deposit / CR AR and marks the invoice partial", async () => {
    setSelectResults([[openInvoice], [{ id: "cash" }], [{ id: "ar" }]]);
    lockedInvoice = openInvoice;

    const result = await recordInvoicePayment({ ...base, amount: 40 });

    expect(insertedPayment).toMatchObject({
      bookId: "book-1",
      invoiceId: "inv-1",
      amount: "40.0000",
      depositAccountId: "cash",
    });
    expect(insertedEntry).toMatchObject({
      source: "invoice_payment",
      sourceReferenceId: "pay-1",
    });
    expect(insertedLines).toEqual([
      {
        journalEntryId: "entry-1",
        accountId: "cash",
        debit: "40.0000",
        credit: "0.0000",
      },
      {
        journalEntryId: "entry-1",
        accountId: "ar",
        debit: "0.0000",
        credit: "40.0000",
      },
    ]);
    expect(invoiceUpdate).toMatchObject({
      amountPaid: "40.0000",
      status: "partial",
    });
    expect(result).toMatchObject({
      paymentId: "pay-1",
      invoiceStatus: "partial",
      amountPaid: 40,
    });
  });

  test("marks the invoice paid when the balance is cleared", async () => {
    const partial = { ...openInvoice, status: "partial", amountPaid: "60" };
    setSelectResults([[partial], [{ id: "cash" }], [{ id: "ar" }]]);
    lockedInvoice = partial;

    const result = await recordInvoicePayment({ ...base, amount: 40 });

    expect(result.invoiceStatus).toBe("paid");
    expect(invoiceUpdate).toMatchObject({
      amountPaid: "100.0000",
      status: "paid",
    });
  });

  test("rejects overpayment", async () => {
    setSelectResults([[openInvoice], [{ id: "cash" }], [{ id: "ar" }]]);
    await expect(
      recordInvoicePayment({ ...base, amount: 150 }),
    ).rejects.toThrow(/exceeds the balance/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects a concurrent payment via the in-transaction locked re-read", async () => {
    // Outer read is stale (nothing paid yet) so the fast-fail check passes, but
    // a racing payment already cleared the invoice: the FOR UPDATE re-read sees
    // amountPaid = total and the payment is rejected instead of double-crediting AR
    setSelectResults([[openInvoice], [{ id: "cash" }], [{ id: "ar" }]]);
    lockedInvoice = { ...openInvoice, status: "partial", amountPaid: "100" };

    await expect(recordInvoicePayment({ ...base, amount: 40 })).rejects.toThrow(
      /exceeds the balance/,
    );
    expect(invoiceUpdate).toBeNull();
  });

  test("rejects a non-positive amount", async () => {
    await expect(recordInvoicePayment({ ...base, amount: 0 })).rejects.toThrow(
      /must be positive/,
    );
  });

  test("rejects a payment on a draft invoice", async () => {
    setSelectResults([[{ ...openInvoice, status: "draft" }]]);
    await expect(recordInvoicePayment({ ...base, amount: 10 })).rejects.toThrow(
      /posted, unpaid/,
    );
  });

  test("rejects a cross-book invoice (IDOR)", async () => {
    setSelectResults([[{ ...openInvoice, bookId: "other-book" }]]);
    await expect(recordInvoicePayment({ ...base, amount: 10 })).rejects.toThrow(
      /not found/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
