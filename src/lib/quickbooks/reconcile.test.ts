import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  connectedAccountTable,
  quickbooksReconciliationLineTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";
import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

import type { QboReportAccountBalance, QboTokens } from "./quickbooksClient";

// Real client, imported via query param so it is never subject to the
// mock.module registration below. Spreading it into the mock keeps the other
// exports intact for sibling consumers, overriding only the one function
// reconcile drives
// @ts-expect-error -- query-param import has no type declarations
const realClient = await import("./quickbooksClient.ts?real");
// @ts-expect-error -- query-param import has no type declarations
const realTrialBalance = await import("lib/reports/trialBalance?real");

// Capture every dbPool.update: which table it targeted and the values set
const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
const mockUpdate = mock((table: unknown) => ({
  set: (values: Record<string, unknown>) => {
    updates.push({ table, values });
    return { where: () => Promise.resolve([]) };
  },
}));

// Capture every dbPool.insert: which table it targeted and the rows written
const inserts: Array<{ table: unknown; values: unknown }> = [];
const mockInsert = mock((table: unknown) => ({
  values: (values: unknown) => {
    inserts.push({ table, values });
    return Promise.resolve([]);
  },
}));

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, update: mockUpdate, insert: mockInsert },
}));

const mockEncryptToken = mock((plaintext: string) => `enc(${plaintext})`);
const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

// The trial balance the QBO client returns, plus a way to force a throw
let qboBalances: QboReportAccountBalance[] = [];
let qboError: Error | null = null;
const qboCalls: Array<{ start: string; end: string; accessToken: string }> = [];
let capturedOnRefresh: ((tokens: QboTokens) => Promise<void>) | null = null;
const mockQueryTrialBalanceReport = mock(
  (
    conn: { accessToken: string },
    opts: {
      start: string;
      end: string;
      onRefresh: (t: QboTokens) => Promise<void>;
    },
  ) => {
    qboCalls.push({
      start: opts.start,
      end: opts.end,
      accessToken: conn.accessToken,
    });
    capturedOnRefresh = opts.onRefresh;
    if (qboError) {
      return Promise.reject(qboError);
    }
    return Promise.resolve(qboBalances);
  },
);
mock.module("./quickbooksClient", () => ({
  ...realClient,
  queryTrialBalanceReport: mockQueryTrialBalanceReport,
}));

// MyFi's own trial balance, shaped like lib/reports/trialBalance output
type MyfiAccount = {
  accountId: string;
  accountName: string;
  accountType: string;
  debitTotal: string;
  creditTotal: string;
};
let myfiAccounts: MyfiAccount[] = [];
const myfiCalls: Array<{
  bookId: string;
  startDate: string;
  endDate: string;
}> = [];
const mockGenerateTrialBalance = mock(
  (params: { bookId: string; startDate: string; endDate: string }) => {
    myfiCalls.push(params);
    return Promise.resolve({
      bookId: params.bookId,
      startDate: params.startDate,
      endDate: params.endDate,
      accounts: myfiAccounts,
      totalDebits: "0",
      totalCredits: "0",
      isBalanced: true,
      generatedAt: new Date().toISOString(),
    });
  },
);
mock.module("lib/reports/trialBalance", () => ({
  default: mockGenerateTrialBalance,
}));

// Restore the genuine shared modules after this file's tests. bun runs test
// files in one process and mock.module is global, so leaving the stubs would
// leak into sibling tests that exercise the real modules
afterAll(() => {
  mock.module("./quickbooksClient", () => ({ ...realClient }));
  mock.module("lib/reports/trialBalance", () => ({
    default: realTrialBalance.default,
  }));
});

const { runReconciliation } = await import("./reconcile");

const ACCOUNT = {
  id: "conn-1",
  bookId: "book-1",
  accessToken: "enc-access",
  refreshToken: "enc-refresh",
  realmId: "realm-1",
};

const RUN = {
  id: "recon-1",
  bookId: "book-1",
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-01-31T00:00:00.000Z",
};

const setup = (
  overrides: {
    account?: Record<string, unknown>;
    run?: Record<string, unknown>;
    map?: Array<Record<string, unknown>>;
  } = {},
) => {
  const account = { ...ACCOUNT, ...overrides.account };
  const run = { ...RUN, ...overrides.run };
  const map = overrides.map ?? [];
  setSelectResults([[account], [run], map]);
};

const reconUpdates = () =>
  updates.filter((u) => u.table === quickbooksReconciliationTable);
const connectedUpdates = () =>
  updates.filter((u) => u.table === connectedAccountTable);
const lineRows = (): Array<Record<string, unknown>> =>
  inserts
    .filter((i) => i.table === quickbooksReconciliationLineTable)
    .flatMap((i) => (Array.isArray(i.values) ? i.values : [i.values]));

beforeEach(() => {
  resetDbMock();
  updates.length = 0;
  inserts.length = 0;
  qboCalls.length = 0;
  myfiCalls.length = 0;
  qboBalances = [];
  qboError = null;
  myfiAccounts = [];
  capturedOnRefresh = null;
  mockUpdate.mockClear();
  mockInsert.mockClear();
  mockQueryTrialBalanceReport.mockClear();
  mockGenerateTrialBalance.mockClear();
  mockEncryptToken.mockClear();
  mockDecryptToken.mockClear();
});

describe("runReconciliation", () => {
  test("matched account with equal nets has zero variance and is not a mismatch", async () => {
    setup({ map: [{ qboAccountId: "qbo-1", myfiAccountId: "myfi-1" }] });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Cash QBO", debit: 100, credit: 0 },
    ];
    myfiAccounts = [
      {
        accountId: "myfi-1",
        accountName: "Cash",
        accountType: "asset",
        debitTotal: "100.00",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(result).toEqual({ totalVariance: "0.0000", mismatchCount: 0 });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reconciliationId: "recon-1",
      bookId: "book-1",
      myfiAccountId: "myfi-1",
      qboAccountId: "qbo-1",
      // MyFi name is preferred over the QBO name when the account is known
      accountName: "Cash",
      qboBalance: "100.0000",
      myfiBalance: "100.0000",
      variance: "0.0000",
    });

    const last = reconUpdates().at(-1);
    expect(last?.values.status).toBe("complete");
    expect(last?.values.totalVariance).toBe("0.0000");
    expect(last?.values.mismatchCount).toBe(0);
  });

  test("sets status running before fetching balances", async () => {
    setup();

    await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(reconUpdates()[0]?.values.status).toBe("running");
    // The period is normalized to plain ISO dates for both sides
    expect(qboCalls[0]).toMatchObject({
      start: "2026-01-01",
      end: "2026-01-31",
    });
    expect(myfiCalls[0]).toMatchObject({
      bookId: "book-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    // The QBO client is called with the decrypted access token
    expect(qboCalls[0]?.accessToken).toBe("dec(enc-access)");
  });

  test("matched account off by 10 yields variance 10 and one mismatch", async () => {
    setup({ map: [{ qboAccountId: "qbo-1", myfiAccountId: "myfi-1" }] });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Cash", debit: 100, credit: 0 },
    ];
    myfiAccounts = [
      {
        accountId: "myfi-1",
        accountName: "Cash",
        accountType: "asset",
        debitTotal: "90",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(result).toEqual({ totalVariance: "10.0000", mismatchCount: 1 });
    expect(lineRows()[0]).toMatchObject({
      qboBalance: "100.0000",
      myfiBalance: "90.0000",
      variance: "10.0000",
    });
  });

  test("QBO account with a null id is recorded unmapped with zero MyFi balance", async () => {
    setup();
    qboBalances = [
      {
        qboAccountId: null,
        accountName: "Uncategorized",
        debit: 50,
        credit: 0,
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      myfiAccountId: null,
      qboAccountId: null,
      accountName: "Uncategorized",
      qboBalance: "50.0000",
      myfiBalance: "0.0000",
      variance: "50.0000",
    });
    expect(result).toEqual({ totalVariance: "50.0000", mismatchCount: 1 });
  });

  test("QBO account whose id is not in the map is recorded unmapped", async () => {
    setup({ map: [{ qboAccountId: "qbo-1", myfiAccountId: "myfi-1" }] });
    qboBalances = [
      { qboAccountId: "qbo-99", accountName: "Stray", debit: 0, credit: 25 },
    ];

    await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      myfiAccountId: null,
      qboAccountId: "qbo-99",
      accountName: "Stray",
      qboBalance: "-25.0000",
      myfiBalance: "0.0000",
      variance: "-25.0000",
    });
  });

  test("MyFi-only account has zero QBO balance and variance equal to negative MyFi net", async () => {
    setup();
    myfiAccounts = [
      {
        accountId: "myfi-2",
        accountName: "Rent",
        accountType: "expense",
        debitTotal: "40",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      myfiAccountId: "myfi-2",
      qboAccountId: null,
      accountName: "Rent",
      qboBalance: "0.0000",
      myfiBalance: "40.0000",
      variance: "-40.0000",
    });
    expect(result).toEqual({ totalVariance: "40.0000", mismatchCount: 1 });
  });

  test("mixed batch aggregates absolute variance and counts mismatches over tolerance", async () => {
    setup({
      map: [
        { qboAccountId: "qbo-1", myfiAccountId: "myfi-1" },
        { qboAccountId: "qbo-2", myfiAccountId: "myfi-2" },
      ],
    });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Cash", debit: 100, credit: 0 },
      { qboAccountId: "qbo-2", accountName: "Rent", debit: 0, credit: 50 },
      { qboAccountId: "qbo-9", accountName: "Misc", debit: 5, credit: 0 },
    ];
    myfiAccounts = [
      {
        accountId: "myfi-1",
        accountName: "Cash",
        accountType: "asset",
        debitTotal: "100",
        creditTotal: "0",
      },
      {
        accountId: "myfi-2",
        accountName: "Rent",
        accountType: "expense",
        debitTotal: "0",
        creditTotal: "40",
      },
      {
        accountId: "myfi-3",
        accountName: "Supplies",
        accountType: "expense",
        debitTotal: "20",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    // Two mapped pairs, one QBO-only, one MyFi-only, no double counting
    expect(rows).toHaveLength(4);

    const byQbo = new Map(rows.map((r) => [r.qboAccountId, r]));
    expect(byQbo.get("qbo-1")).toMatchObject({
      qboBalance: "100.0000",
      myfiBalance: "100.0000",
      variance: "0.0000",
    });
    expect(byQbo.get("qbo-2")).toMatchObject({
      qboBalance: "-50.0000",
      myfiBalance: "-40.0000",
      variance: "-10.0000",
    });
    expect(byQbo.get("qbo-9")).toMatchObject({
      myfiAccountId: null,
      qboBalance: "5.0000",
      myfiBalance: "0.0000",
      variance: "5.0000",
    });

    const myfiOnly = rows.find((r) => r.myfiAccountId === "myfi-3");
    expect(myfiOnly).toMatchObject({
      qboAccountId: null,
      qboBalance: "0.0000",
      myfiBalance: "20.0000",
      variance: "-20.0000",
    });

    // |0| + |-10| + |5| + |-20| = 35
    expect(result).toEqual({ totalVariance: "35.0000", mismatchCount: 3 });
    const last = reconUpdates().at(-1);
    expect(last?.values.status).toBe("complete");
    expect(last?.values.totalVariance).toBe("35.0000");
    expect(last?.values.mismatchCount).toBe(3);
  });

  test("consolidates multiple QBO accounts mapping to one MyFi account into a single tie-out line", async () => {
    // qbo-1 (60) + qbo-2 (40) both map to myfi-1 (100): the two QBO accounts
    // were consolidated into one MyFi account, so the summed QBO net ties out
    // exactly and must not read as a double-counted variance
    setup({
      map: [
        { qboAccountId: "qbo-1", myfiAccountId: "myfi-1" },
        { qboAccountId: "qbo-2", myfiAccountId: "myfi-1" },
      ],
    });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Checking", debit: 60, credit: 0 },
      { qboAccountId: "qbo-2", accountName: "Savings", debit: 40, credit: 0 },
    ];
    myfiAccounts = [
      {
        accountId: "myfi-1",
        accountName: "Cash",
        accountType: "asset",
        debitTotal: "100",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      myfiAccountId: "myfi-1",
      // An aggregate of several QBO accounts carries no single qboAccountId
      qboAccountId: null,
      accountName: "Cash",
      qboBalance: "100.0000",
      myfiBalance: "100.0000",
      variance: "0.0000",
    });
    expect(result).toEqual({ totalVariance: "0.0000", mismatchCount: 0 });
  });

  test("consolidated group with a real variance yields one line and one mismatch", async () => {
    // qbo-1 (60) + qbo-2 (30) = 90 against myfi-1 (100): a genuine -10 variance
    setup({
      map: [
        { qboAccountId: "qbo-1", myfiAccountId: "myfi-1" },
        { qboAccountId: "qbo-2", myfiAccountId: "myfi-1" },
      ],
    });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Checking", debit: 60, credit: 0 },
      { qboAccountId: "qbo-2", accountName: "Savings", debit: 30, credit: 0 },
    ];
    myfiAccounts = [
      {
        accountId: "myfi-1",
        accountName: "Cash",
        accountType: "asset",
        debitTotal: "100",
        creditTotal: "0",
      },
    ];

    const result = await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const rows = lineRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      myfiAccountId: "myfi-1",
      qboAccountId: null,
      qboBalance: "90.0000",
      myfiBalance: "100.0000",
      variance: "-10.0000",
    });
    expect(result).toEqual({ totalVariance: "10.0000", mismatchCount: 1 });
  });

  test("throws when the connected account belongs to a different book, writing no lines", async () => {
    setup({ account: { bookId: "other-book" } });
    qboBalances = [
      { qboAccountId: "qbo-1", accountName: "Cash", debit: 100, credit: 0 },
    ];

    await expect(
      runReconciliation({
        reconciliationId: "recon-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(/does not belong to this book/i);

    expect(lineRows()).toHaveLength(0);
    expect(mockQueryTrialBalanceReport).not.toHaveBeenCalled();
    const last = reconUpdates().at(-1);
    expect(last?.values.status).toBe("failed");
  });

  test("marks the run failed with a generic message and rethrows when the QBO fetch throws", async () => {
    setup();
    qboError = new Error("boom AQAB-secret-token dec(enc-access)");

    await expect(
      runReconciliation({
        reconciliationId: "recon-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow();

    expect(lineRows()).toHaveLength(0);
    const last = reconUpdates().at(-1);
    expect(last?.values.status).toBe("failed");
    const message = String(last?.values.errorMessage);
    expect(message).not.toContain("secret");
    expect(message).not.toContain("token");
    expect(message).not.toContain("enc-access");
    expect(message).not.toContain("AQAB");
  });

  test("throws when the connected account is missing QuickBooks credentials", async () => {
    setup({ account: { accessToken: null } });

    await expect(
      runReconciliation({
        reconciliationId: "recon-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(/credentials/i);

    const last = reconUpdates().at(-1);
    expect(last?.values.status).toBe("failed");
    expect(mockQueryTrialBalanceReport).not.toHaveBeenCalled();
  });

  test("persists encrypted rotated tokens to the connected account on refresh", async () => {
    setup();

    await runReconciliation({
      reconciliationId: "recon-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(capturedOnRefresh).not.toBeNull();
    await capturedOnRefresh?.({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });

    const connUps = connectedUpdates();
    expect(connUps).toHaveLength(1);
    expect(connUps[0]?.values.accessToken).toBe("enc(new-access)");
    expect(connUps[0]?.values.refreshToken).toBe("enc(new-refresh)");
  });
});
