import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const mockProcessTransaction = mock(
  (): Promise<unknown> =>
    Promise.resolve({
      entryId: "entry-1",
      status: "approved",
      priority: 0,
      confidence: 0.95,
    }),
);

mock.module("lib/import/processTransaction", () => ({
  processTransaction: mockProcessTransaction,
}));

const mockDecryptToken = mock(() => "decrypted-token");
mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: mockDecryptToken,
}));

const mockTransactionsSync = mock(() =>
  Promise.resolve({
    data: {
      added: [
        {
          transaction_id: "plaid-txn-1",
          amount: 42.5,
          date: "2026-04-08",
          name: "ACME Corp",
          merchant_name: "ACME Corp",
          personal_finance_category: { primary: "GENERAL_MERCHANDISE" },
        },
      ],
      next_cursor: "cursor-2",
      has_more: false,
    },
  }),
);

mock.module("./plaidClient", () => ({
  default: { transactionsSync: mockTransactionsSync },
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Query param forces a fresh module instance, bypassing the mock.module
// registered for "lib/plaid/syncTransactions" by monthlyClose.test.ts
// @ts-expect-error -- query-param import has no type declarations
const realSync = await import("./syncTransactions.ts?real");
mock.module("lib/plaid/syncTransactions", () => realSync);

const syncTransactions = realSync.default as (
  ca: Record<string, unknown>,
) => Promise<{ addedCount: number }>;

describe("syncTransactions", () => {
  beforeEach(() => {
    resetDbMock();
    mockProcessTransaction.mockClear();
    mockTransactionsSync.mockClear();
  });

  test("delegates to processTransaction for each Plaid transaction", async () => {
    // Dedup check returns no existing entry
    setSelectResults([[]]);

    const result = await syncTransactions({
      id: "conn-1",
      bookId: "book-1",
      accessToken: "encrypted-token",
      syncCursor: null,
    });

    expect(result.addedCount).toBe(1);
    expect(mockProcessTransaction).toHaveBeenCalledTimes(1);

    const [txnArg, optsArg] = mockProcessTransaction.mock
      .calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(txnArg.memo).toBe("ACME Corp");
    expect(txnArg.plaidCategory).toBe("GENERAL_MERCHANDISE");
    expect(optsArg.source).toBe("plaid_import");
  });

  test("skips already-imported transactions", async () => {
    // Dedup check finds existing
    setSelectResults([[{ id: "existing-1" }]]);

    const result = await syncTransactions({
      id: "conn-1",
      bookId: "book-1",
      accessToken: "encrypted-token",
      syncCursor: null,
    });

    expect(result.addedCount).toBe(0);
    expect(mockProcessTransaction).not.toHaveBeenCalled();
  });
});
