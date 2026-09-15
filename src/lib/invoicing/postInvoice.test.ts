import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
let invoiceUpdate: Record<string, unknown> | null = null;

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
  invoiceUpdate = values;
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
  insertedEntry = null;
  insertedLines.length = 0;
  invoiceUpdate = null;
  txInsertValues.mockClear();
  txUpdateSet.mockClear();
  txUpdateWhere.mockClear();
  mockTransaction.mockClear();
});

describe("postInvoice", () => {
  test("posts a draft invoice: AR debit, income and tax credits, invoice opened", async () => {
    setSelectResults([
      [draftInvoice],
      [
        {
          quantity: "2",
          unitPrice: "50",
          incomeAccountId: "sales",
          taxRate: "0.0825",
          taxPayableAccountId: "tax",
        },
        {
          quantity: "1",
          unitPrice: "30",
          incomeAccountId: "service",
          taxRate: null,
          taxPayableAccountId: null,
        },
      ],
      [{ id: "ar" }],
    ]);

    const result = await postInvoice("inv-1", "book-1");

    expect(insertedEntry).toMatchObject({
      bookId: "book-1",
      date: "2026-09-01",
      source: "invoice",
      sourceReferenceId: "inv-1",
      memo: "Invoice 1001",
    });
    // AR debit + sales credit + service credit + tax credit = 4 lines
    expect(insertedLines).toHaveLength(4);
    const ar = insertedLines.find((l) => l.accountId === "ar");
    // 100 (2x50) + 30 + 8.25 tax = 138.25
    expect(ar).toMatchObject({ debit: "138.2500", credit: "0.0000" });
    expect(insertedLines.find((l) => l.accountId === "tax")).toMatchObject({
      credit: "8.2500",
    });

    expect(invoiceUpdate).toMatchObject({
      status: "open",
      subtotal: "130.0000",
      taxAmount: "8.2500",
      total: "138.2500",
      journalEntryId: "entry-1",
    });
    expect(result).toMatchObject({
      journalEntryId: "entry-1",
      total: 138.25,
      alreadyPosted: false,
    });
  });

  test("is idempotent: an already-posted invoice is a no-op", async () => {
    setSelectResults([
      [
        {
          ...draftInvoice,
          status: "open",
          journalEntryId: "entry-9",
          total: "100",
        },
      ],
    ]);

    const result = await postInvoice("inv-1", "book-1");

    expect(result).toEqual({
      invoiceId: "inv-1",
      journalEntryId: "entry-9",
      total: 100,
      alreadyPosted: true,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("throws when the book has no Accounts Receivable account", async () => {
    setSelectResults([
      [draftInvoice],
      [
        {
          quantity: "1",
          unitPrice: "10",
          incomeAccountId: "sales",
          taxRate: null,
          taxPayableAccountId: null,
        },
      ],
      [],
    ]);

    await expect(postInvoice("inv-1", "book-1")).rejects.toThrow(
      /Accounts Receivable/,
    );
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("throws when the invoice does not exist", async () => {
    setSelectResults([[]]);
    await expect(postInvoice("missing", "book-1")).rejects.toThrow(/not found/);
  });

  test("throws on a cross-book invoice (IDOR)", async () => {
    setSelectResults([[{ ...draftInvoice, bookId: "other-book" }]]);
    await expect(postInvoice("inv-1", "book-1")).rejects.toThrow(/not found/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("throws when a draft invoice has no lines", async () => {
    setSelectResults([[draftInvoice], [], [{ id: "ar" }]]);
    await expect(postInvoice("inv-1", "book-1")).rejects.toThrow(/no lines/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
