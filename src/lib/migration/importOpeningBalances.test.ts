import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool } from "lib/test/mockDb";

import type { OpeningBalanceLine } from "./importOpeningBalances";

// Capture what the importer writes inside its single transaction
let insertedEntry: Record<string, unknown> | null = null;
const insertedLines: Array<Record<string, unknown>> = [];
// Rows the delete-then-replace step reports as removed
let deletedRows: Array<{ id: string }> = [];
let entrySeq = 0;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    insertedEntry = values;
    return { returning: mock(() => [{ id: `entry-${++entrySeq}` }]) };
  }
  insertedLines.push(values);
  return {};
});

const txDeleteWhere = mock(() => ({
  returning: mock(() => deletedRows),
}));

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock(() => ({ values: txInsertValues })),
    delete: mock(() => ({ where: txDeleteWhere })),
  };

  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const { importOpeningBalances } = await import("./importOpeningBalances");

const AS_OF = "2026-08-31T00:00:00.000Z";

const balancedLines = (): OpeningBalanceLine[] => [
  { accountId: "acct-cash", debit: 12500, credit: 0, name: "Checking" },
  { accountId: "acct-ar", debit: 3200, credit: 0, name: "Accounts Receivable" },
  { accountId: "acct-ap", debit: 0, credit: 1700, name: "Accounts Payable" },
  {
    accountId: "acct-eq",
    debit: 0,
    credit: 14000,
    name: "Opening Balance Equity",
  },
];

beforeEach(() => {
  insertedEntry = null;
  insertedLines.length = 0;
  deletedRows = [];
  entrySeq = 0;
  txInsertValues.mockClear();
  txDeleteWhere.mockClear();
  mockTransaction.mockClear();
});

describe("importOpeningBalances", () => {
  test("writes one balanced opening-balance entry with a line per account", async () => {
    const result = await importOpeningBalances({
      bookId: "book-1",
      asOf: AS_OF,
      lines: balancedLines(),
    });

    expect(insertedEntry).toMatchObject({
      bookId: "book-1",
      date: AS_OF,
      source: "quickbooks_opening_balance",
      sourceReferenceId: "opening-balance",
    });
    expect(insertedLines).toHaveLength(4);
    // Amounts are written at 4-decimal scale
    expect(insertedLines[0]).toMatchObject({
      debit: "12500.0000",
      credit: "0.0000",
    });
    expect(result).toEqual({
      entryId: "entry-1",
      lineCount: 4,
      replaced: false,
    });
  });

  test("reports replaced=true when a prior opening-balance entry was removed", async () => {
    deletedRows = [{ id: "old-entry" }];

    const result = await importOpeningBalances({
      bookId: "book-1",
      asOf: AS_OF,
      lines: balancedLines(),
    });

    expect(txDeleteWhere).toHaveBeenCalledTimes(1);
    expect(result.replaced).toBe(true);
  });

  test("rejects an unbalanced trial balance before writing", async () => {
    const unbalanced: OpeningBalanceLine[] = [
      { accountId: "acct-cash", debit: 12500, credit: 0 },
      { accountId: "acct-ap", debit: 0, credit: 1700 },
    ];

    await expect(
      importOpeningBalances({
        bookId: "book-1",
        asOf: AS_OF,
        lines: unbalanced,
      }),
    ).rejects.toThrow(/does not balance/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("rejects an empty trial balance", async () => {
    await expect(
      importOpeningBalances({ bookId: "book-1", asOf: AS_OF, lines: [] }),
    ).rejects.toThrow(/no account lines/);
  });

  test("balances exactly in integer ten-thousandths (no float drift)", async () => {
    // 0.1 + 0.2 !== 0.3 in float, but the cents-integer check must accept it
    const lines: OpeningBalanceLine[] = [
      { accountId: "a", debit: 0.1, credit: 0 },
      { accountId: "b", debit: 0.2, credit: 0 },
      { accountId: "c", debit: 0, credit: 0.3 },
    ];

    await expect(
      importOpeningBalances({ bookId: "book-1", asOf: AS_OF, lines }),
    ).resolves.toMatchObject({ lineCount: 3 });
  });
});
