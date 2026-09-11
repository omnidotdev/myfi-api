import { beforeEach, describe, expect, mock, test } from "bun:test";

import { connectedAccountTable, quickbooksMigrationTable } from "lib/db/schema";
import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

import type { QboJournalEntry, QboTokens } from "./quickbooksClient";

// Real sibling modules, imported via query param so they are never subject to
// the mock.module registrations below. Spreading them into each mock keeps the
// other exports intact for unrelated consumers (e.g. mapAccounts imports
// queryAccounts from quickbooksClient), overriding only the one function
// backfill drives
// @ts-expect-error -- query-param import has no type declarations
const realClient = await import("./quickbooksClient.ts?real");
// @ts-expect-error -- query-param import has no type declarations
const realImport = await import("./importJournalEntries.ts?real");

// Capture every dbPool.update: which table it targeted and the values set
const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
const mockUpdate = mock((table: unknown) => ({
  set: (values: Record<string, unknown>) => {
    updates.push({ table, values });
    return { where: () => Promise.resolve([]) };
  },
}));

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, update: mockUpdate },
}));

const mockEncryptToken = mock((plaintext: string) => `enc(${plaintext})`);
const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mockEncryptToken,
  decryptToken: mockDecryptToken,
}));

// Queue of journal-entry pages returned by successive queryJournalEntries calls
let jeQueue: QboJournalEntry[][] = [];
// Records each queryJournalEntries call: the window bounds and the access
// token present on the connection at call time (to prove token rotation)
const queryCalls: Array<{ start: string; end: string; accessToken: string }> =
  [];
let capturedOnRefresh: ((tokens: QboTokens) => Promise<void>) | null = null;
// When set, the queryJournalEntries call at this index invokes onRefresh to
// simulate a mid-backfill token rotation
let refreshOnCallIndex: number | null = null;
const REFRESHED_TOKENS = {
  accessToken: "refreshed-access",
  refreshToken: "refreshed-refresh",
};
const mockQueryJournalEntries = mock(
  (
    conn: { accessToken: string },
    opts: {
      start: string;
      end: string;
      onRefresh: (t: QboTokens) => Promise<void>;
    },
  ) => {
    const callIndex = queryCalls.length;
    queryCalls.push({
      start: opts.start,
      end: opts.end,
      accessToken: conn.accessToken,
    });
    capturedOnRefresh = opts.onRefresh;
    const page = jeQueue[callIndex] ?? [];
    if (refreshOnCallIndex === callIndex) {
      return opts.onRefresh(REFRESHED_TOKENS).then(() => page);
    }
    return Promise.resolve(page);
  },
);
// By default the company is single-currency, so the up-front check passes
let preferencesResult: unknown = {
  CurrencyPrefs: { MultiCurrencyEnabled: false },
};
const mockQueryPreferences = mock(() => Promise.resolve(preferencesResult));
mock.module("./quickbooksClient", () => ({
  ...realClient,
  queryJournalEntries: mockQueryJournalEntries,
  queryPreferences: mockQueryPreferences,
}));

// Capture importJournalEntries calls; impl is swappable per test
type ImportOpts = {
  bookId: string;
  accountMap: Map<string, string>;
  entries: Array<Record<string, unknown>>;
};
const importCalls: ImportOpts[] = [];
let importImpl: (
  opts: ImportOpts,
) => Promise<{ addedCount: number; skippedCount: number }> = (opts) =>
  Promise.resolve({ addedCount: opts.entries.length, skippedCount: 0 });
const mockImport = mock((opts: ImportOpts) => {
  importCalls.push(opts);
  return importImpl(opts);
});
mock.module("./importJournalEntries", () => ({
  ...realImport,
  importJournalEntries: mockImport,
}));

const { runBackfill } = await import("./backfill");

const ACCOUNT = {
  id: "conn-1",
  bookId: "book-1",
  accessToken: "enc-access",
  refreshToken: "enc-refresh",
  realmId: "realm-1",
};

const setupSelects = (
  migration: Record<string, unknown>,
  accountMap: Array<Record<string, unknown>> = [
    { qboAccountId: "qbo-1", myfiAccountId: "myfi-1" },
    { qboAccountId: "qbo-2", myfiAccountId: "myfi-2" },
  ],
) => {
  setSelectResults([[ACCOUNT], [migration], accountMap]);
};

const migrationUpdates = () =>
  updates.filter((u) => u.table === quickbooksMigrationTable);
const connectedUpdates = () =>
  updates.filter((u) => u.table === connectedAccountTable);

beforeEach(() => {
  resetDbMock();
  updates.length = 0;
  importCalls.length = 0;
  queryCalls.length = 0;
  jeQueue = [];
  capturedOnRefresh = null;
  refreshOnCallIndex = null;
  preferencesResult = { CurrencyPrefs: { MultiCurrencyEnabled: false } };
  importImpl = (opts) =>
    Promise.resolve({ addedCount: opts.entries.length, skippedCount: 0 });
  mockUpdate.mockClear();
  mockImport.mockClear();
  mockQueryJournalEntries.mockClear();
  mockQueryPreferences.mockClear();
  mockEncryptToken.mockClear();
});

const entry = (
  id: string,
  overrides: Partial<QboJournalEntry> = {},
): QboJournalEntry => ({
  Id: id,
  TxnDate: "2026-01-10",
  PrivateNote: "memo",
  Line: [
    {
      Amount: 100,
      Description: "debit line",
      JournalEntryLineDetail: {
        PostingType: "Debit",
        AccountRef: { value: "qbo-1" },
      },
    },
    {
      Amount: 100,
      Description: "credit line",
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: { value: "qbo-2" },
      },
    },
  ],
  ...overrides,
});

describe("runBackfill", () => {
  test("imports across two monthly windows and completes with a total that counts added plus skipped", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-15",
    });
    jeQueue = [[entry("je-1")], [entry("je-2")]];
    // Each window: one new insert and one already-present (skipped) entry, so
    // the persisted total must reflect both, not just fresh inserts
    importImpl = () => Promise.resolve({ addedCount: 1, skippedCount: 1 });

    const result = await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(mockImport).toHaveBeenCalledTimes(2);
    expect(result.entriesImported).toBe(4);

    const migUps = migrationUpdates();
    // first update flips to importing
    expect(migUps[0]?.values.status).toBe("importing");
    // rolling progress after the first window counts added + skipped
    expect(migUps[1]?.values.entriesImported).toBe(2);
    // last update marks complete with the final total
    const last = migUps[migUps.length - 1];
    expect(last?.values.status).toBe("complete");
    expect(last?.values.entriesImported).toBe(4);
  });

  test("date-chunks a two-month range into two windows with correct bounds", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-15",
    });
    jeQueue = [[], []];

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(queryCalls.map((c) => ({ start: c.start, end: c.end }))).toEqual([
      { start: "2026-01-01", end: "2026-01-31" },
      { start: "2026-02-01", end: "2026-02-15" },
    ]);
  });

  test("date-chunks a range crossing a year boundary and a leap February", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2023-12-15",
      periodEnd: "2024-03-05",
    });

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(queryCalls.map((c) => ({ start: c.start, end: c.end }))).toEqual([
      { start: "2023-12-15", end: "2023-12-31" },
      { start: "2024-01-01", end: "2024-01-31" },
      // 2024 is a leap year, so February runs through the 29th
      { start: "2024-02-01", end: "2024-02-29" },
      { start: "2024-03-01", end: "2024-03-05" },
    ]);
  });

  test("maps debit and credit lines to the correct shape", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [[entry("je-1")]];

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const captured = importCalls[0];
    expect(captured?.bookId).toBe("book-1");
    const lines = (
      captured?.entries[0] as { lines: Array<Record<string, unknown>> }
    ).lines;
    expect(lines[0]).toEqual({
      qboAccountId: "qbo-1",
      debit: 100,
      credit: 0,
      memo: "debit line",
    });
    expect(lines[1]).toEqual({
      qboAccountId: "qbo-2",
      debit: 0,
      credit: 100,
      memo: "credit line",
    });
    const mapped = captured?.entries[0] as Record<string, unknown>;
    expect(mapped.qboEntryId).toBe("je-1");
    expect(mapped.date).toBe("2026-01-10");
    expect(mapped.memo).toBe("memo");
  });

  test("skips non-posting lines that have no JournalEntryLineDetail", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [
      [
        entry("je-1", {
          Line: [
            { Amount: 200, Description: "non-posting" },
            {
              Amount: 100,
              Description: "debit line",
              JournalEntryLineDetail: {
                PostingType: "Debit",
                AccountRef: { value: "qbo-1" },
              },
            },
            {
              Amount: 100,
              Description: "credit line",
              JournalEntryLineDetail: {
                PostingType: "Credit",
                AccountRef: { value: "qbo-2" },
              },
            },
          ],
        }),
      ],
    ];

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const lines = (
      importCalls[0]?.entries[0] as {
        lines: Array<Record<string, unknown>>;
      }
    ).lines;
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.qboAccountId !== undefined)).toBe(true);
  });

  test("marks the migration failed with a generic message and rethrows", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [[entry("je-1")]];
    importImpl = () => Promise.reject(new Error("boom AQAB-secret-token"));

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow();

    const migUps = migrationUpdates();
    const last = migUps[migUps.length - 1];
    expect(last?.values.status).toBe("failed");
    const message = String(last?.values.errorMessage);
    expect(message).not.toContain("secret");
    expect(message).not.toContain("token");
    expect(message).not.toContain("enc-access");
    expect(message).not.toContain("enc-refresh");
  });

  test("persists encrypted tokens when the client refreshes", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [[entry("je-1")]];

    await runBackfill({
      migrationId: "mig-1",
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

  test("uses refreshed tokens on the connection for windows after a refresh", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-15",
    });
    jeQueue = [[entry("je-1")], [entry("je-2")]];
    // The client rotates tokens while serving the first window
    refreshOnCallIndex = 0;

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    expect(queryCalls).toHaveLength(2);
    // First window sees the original decrypted access token
    expect(queryCalls[0]?.accessToken).toBe("dec(enc-access)");
    // After the refresh, the second window sees the rotated access token,
    // proving onRefresh mutated the in-memory connection
    expect(queryCalls[1]?.accessToken).toBe("refreshed-access");
  });

  test("persists encrypted rotated tokens to the connected account", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [[entry("je-1")]];

    await runBackfill({
      migrationId: "mig-1",
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

  test("refuses up front when the company has multi-currency enabled, importing nothing", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    jeQueue = [[entry("je-1")]];
    preferencesResult = { CurrencyPrefs: { MultiCurrencyEnabled: true } };

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(
      "Multi-currency QuickBooks companies are not yet supported",
    );

    // Nothing is imported and no window is queried
    expect(mockImport).not.toHaveBeenCalled();
    expect(queryCalls).toHaveLength(0);

    const migUps = migrationUpdates();
    expect(migUps[migUps.length - 1]?.values.status).toBe("failed");
  });

  test("defense-in-depth: refuses when entries reveal a second currency the Preferences flag missed", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    // Preferences reports single-currency, but the entries disagree
    preferencesResult = { CurrencyPrefs: { MultiCurrencyEnabled: false } };
    jeQueue = [
      [
        entry("je-1", { CurrencyRef: { value: "USD" } }),
        entry("je-2", { CurrencyRef: { value: "EUR" } }),
      ],
    ];

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(
      "Multi-currency QuickBooks companies are not yet supported",
    );

    expect(mockImport).not.toHaveBeenCalled();
    const migUps = migrationUpdates();
    expect(migUps[migUps.length - 1]?.values.status).toBe("failed");
  });

  test("throws when the connected account is missing QuickBooks credentials", async () => {
    setSelectResults([
      [{ ...ACCOUNT, accessToken: null }],
      [{ id: "mig-1" }],
      [],
    ]);

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(/credentials/i);

    const migUps = migrationUpdates();
    expect(migUps[migUps.length - 1]?.values.status).toBe("failed");
    expect(mockImport).not.toHaveBeenCalled();
  });

  test("throws when the migration row is not found", async () => {
    setSelectResults([[ACCOUNT], [], []]);

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow(/migration not found/i);

    const migUps = migrationUpdates();
    expect(migUps[migUps.length - 1]?.values.status).toBe("failed");
    expect(mockImport).not.toHaveBeenCalled();
  });

  test("throws on an inverted date range instead of completing empty", async () => {
    setupSelects({
      id: "mig-1",
      periodStart: "2026-03-01",
      periodEnd: "2026-01-01",
    });

    await expect(
      runBackfill({
        migrationId: "mig-1",
        bookId: "book-1",
        connectedAccountId: "conn-1",
      }),
    ).rejects.toThrow("Invalid backfill date range");

    expect(queryCalls).toHaveLength(0);
    const migUps = migrationUpdates();
    expect(migUps[migUps.length - 1]?.values.status).toBe("failed");
  });

  test("defaults a null period to the floor start and today's end", async () => {
    setupSelects({ id: "mig-1", periodStart: null, periodEnd: null });

    await runBackfill({
      migrationId: "mig-1",
      bookId: "book-1",
      connectedAccountId: "conn-1",
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(queryCalls[0]?.start).toBe("2015-01-01");
    expect(queryCalls.at(-1)?.end).toBe(today);
  });
});
