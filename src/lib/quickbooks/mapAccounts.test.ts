import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

import type { QboAccount } from "./quickbooksClient";

// queryAccounts is stubbed so each test drives the QBO chart of accounts
const mockQueryAccounts = mock(
  (): Promise<QboAccount[]> => Promise.resolve([]),
);
mock.module("./quickbooksClient", () => ({ queryAccounts: mockQueryAccounts }));

// Capture the rows handed to the account-map insert, and control how many rows
// the conflict-aware insert reports as newly written (a re-run reports none)
let insertedMapRows: Array<Record<string, unknown>> = [];
let insertReturns: unknown[] = [];
const onConflictDoNothing = mock(() => ({
  returning: mock(() => insertReturns),
}));
const mapInsertValues = mock((rows: Array<Record<string, unknown>>) => {
  insertedMapRows = rows;
  return { onConflictDoNothing };
});

mock.module("lib/db/db", () => ({
  dbPool: {
    ...mockDbPool,
    insert: mock(() => ({ values: mapInsertValues })),
  },
}));

const { syncAccountMap } = await import("./mapAccounts");

const conn = { realmId: "realm-1", accessToken: "a", refreshToken: "r" };
const onRefresh = mock(async () => {});

describe("syncAccountMap", () => {
  beforeEach(() => {
    resetDbMock();
    mockQueryAccounts.mockClear();
    onRefresh.mockClear();
    mapInsertValues.mockClear();
    onConflictDoNothing.mockClear();
    insertedMapRows = [];
    insertReturns = [];
  });

  test("auto-maps on a unique AcctNum == code match", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "Checking", AccountType: "Bank", AcctNum: "1000" },
    ]);
    // The name deliberately differs so a pass proves it matched on code, not name
    setSelectResults([
      [
        { id: "acct-1", code: "1000", name: "Business Checking" },
        { id: "acct-2", code: "2000", name: "Payables" },
      ],
    ]);
    insertReturns = [{ id: "map-1" }];

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(1);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(0);
    expect(insertedMapRows).toHaveLength(1);
    expect(insertedMapRows[0]).toMatchObject({
      bookId: "book-1",
      qboAccountId: "qbo-1",
      qboAccountName: "Checking",
      qboAccountType: "Bank",
      myfiAccountId: "acct-1",
    });
  });

  test("auto-maps on a unique case-insensitive name match when no AcctNum", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "  Office Supplies ", AccountType: "Expense" },
    ]);
    setSelectResults([
      [
        { id: "acct-1", code: "5000", name: "office supplies" },
        { id: "acct-2", code: "6000", name: "Rent" },
      ],
    ]);
    insertReturns = [{ id: "map-1" }];

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(1);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(0);
    expect(insertedMapRows[0]).toMatchObject({
      qboAccountId: "qbo-1",
      myfiAccountId: "acct-1",
    });
  });

  test("falls through to a unique name match when AcctNum matches two codes", async () => {
    mockQueryAccounts.mockResolvedValue([
      {
        Id: "qbo-1",
        Name: "Rent Expense",
        AccountType: "Expense",
        AcctNum: "5000",
      },
    ]);
    // Two MyFi accounts share code 5000 (ambiguous), so match A cannot apply,
    // but exactly one has the QBO name, so match B resolves it
    setSelectResults([
      [
        { id: "acct-1", code: "5000", name: "Office Rent" },
        { id: "acct-2", code: "5000", name: "rent expense" },
      ],
    ]);
    insertReturns = [{ id: "map-1" }];

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(1);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(0);
    expect(insertedMapRows[0]).toMatchObject({
      qboAccountId: "qbo-1",
      myfiAccountId: "acct-2",
    });
  });

  test("does not name-match a QBO account whose name is empty/whitespace", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "   ", AccountType: "Expense" },
    ]);
    // A whitespace-only MyFi name would collide if the empty name were a signal
    setSelectResults([[{ id: "acct-1", code: null, name: "  " }]]);

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(0);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]?.Id).toBe("qbo-1");
    expect(mapInsertValues).not.toHaveBeenCalled();
  });

  test("leaves unmatched when a name matches two MyFi accounts", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "Supplies", AccountType: "Expense" },
    ]);
    setSelectResults([
      [
        { id: "acct-1", code: null, name: "Supplies" },
        { id: "acct-2", code: null, name: "supplies" },
      ],
    ]);

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(0);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]?.Id).toBe("qbo-1");
    // Nothing matched, so no insert was attempted at all
    expect(mapInsertValues).not.toHaveBeenCalled();
  });

  test("leaves unmatched when nothing matches", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "Mystery", AccountType: "Expense", AcctNum: "9999" },
    ]);
    setSelectResults([[{ id: "acct-1", code: "1000", name: "Cash" }]]);

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(0);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]?.Id).toBe("qbo-1");
    expect(mapInsertValues).not.toHaveBeenCalled();
  });

  test("re-running counts a matched-but-conflicted account as alreadyMapped", async () => {
    mockQueryAccounts.mockResolvedValue([
      { Id: "qbo-1", Name: "Cash", AccountType: "Bank", AcctNum: "1000" },
    ]);
    setSelectResults([[{ id: "acct-1", code: "1000", name: "Cash" }]]);
    // The row already exists: onConflictDoNothing inserts nothing, returns no row
    insertReturns = [];

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(0);
    // Matched but conflict-skipped: neither newly mapped nor unmatched
    expect(result.alreadyMapped).toBe(1);
    expect(result.unmatched).toHaveLength(0);
    // The insert went through the conflict-aware path, not a raw insert
    expect(insertedMapRows).toHaveLength(1);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  test("returns empty buckets and skips the insert for no QBO accounts", async () => {
    mockQueryAccounts.mockResolvedValue([]);
    setSelectResults([[{ id: "acct-1", code: "1000", name: "Cash" }]]);

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result).toEqual({ mapped: 0, alreadyMapped: 0, unmatched: [] });
    expect(mapInsertValues).not.toHaveBeenCalled();
  });

  test("queries QBO accounts with the connection and refresh callback", async () => {
    mockQueryAccounts.mockResolvedValue([]);
    setSelectResults([[]]);

    await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(mockQueryAccounts).toHaveBeenCalledTimes(1);
    expect(mockQueryAccounts).toHaveBeenCalledWith(conn, onRefresh);
  });

  test("returns correct mapped/unmatched counts on a mixed batch", async () => {
    mockQueryAccounts.mockResolvedValue([
      {
        Id: "qbo-code",
        Name: "Whatever",
        AccountType: "Bank",
        AcctNum: "1000",
      },
      { Id: "qbo-name", Name: "Rent Expense", AccountType: "Expense" },
      { Id: "qbo-ambig", Name: "Supplies", AccountType: "Expense" },
      { Id: "qbo-none", Name: "Nope", AccountType: "Expense", AcctNum: "9999" },
    ]);
    setSelectResults([
      [
        { id: "acct-1", code: "1000", name: "Cash" },
        { id: "acct-2", code: "5000", name: "rent expense" },
        { id: "acct-3", code: null, name: "Supplies" },
        { id: "acct-4", code: null, name: "supplies" },
      ],
    ]);
    insertReturns = [{ id: "m1" }, { id: "m2" }];

    const result = await syncAccountMap({ bookId: "book-1", conn, onRefresh });

    expect(result.mapped).toBe(2);
    expect(result.alreadyMapped).toBe(0);
    expect(result.unmatched).toHaveLength(2);
    // Every QBO account lands in exactly one bucket
    expect(result.mapped + result.alreadyMapped + result.unmatched.length).toBe(
      4,
    );
    expect(result.unmatched.map((a) => a.Id).sort()).toEqual([
      "qbo-ambig",
      "qbo-none",
    ]);
    expect(insertedMapRows).toHaveLength(2);
    expect(insertedMapRows.map((r) => r.qboAccountId).sort()).toEqual([
      "qbo-code",
      "qbo-name",
    ]);
    expect(insertedMapRows.map((r) => r.myfiAccountId).sort()).toEqual([
      "acct-1",
      "acct-2",
    ]);
  });
});
