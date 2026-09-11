import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { connectedAccountTable, quickbooksCutoverTable } from "lib/db/schema";
import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

// Real client, imported via query param so it is never subject to the
// mock.module registration below. Spreading it into the mock keeps the other
// exports intact for sibling consumers, overriding only revokeToken
// @ts-expect-error -- query-param import has no type declarations
const realClient = await import("./quickbooksClient.ts?real");

// Capture every dbPool.update outside a transaction (there are none in cutover,
// but keep the shape consistent with sibling tests)
const mockUpdate = mock((_table: unknown) => ({
  set: () => ({ where: () => Promise.resolve([]) }),
}));

// Transaction plumbing: the cutover row insert chains
// `.onConflictDoNothing(...).returning()`; when it returns a row the connected
// account is disconnected in the same transaction, otherwise the existing
// cutover id is selected back
const txInsertCalls: Array<{ table: unknown; values: unknown }> = [];
const txUpdateCalls: Array<{
  table: unknown;
  values: Record<string, unknown>;
}> = [];
let cutoverInsertReturning: unknown[] = [];
let existingCutoverRows: unknown[] = [];

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock((table: unknown) => ({
      values: (values: unknown) => ({
        onConflictDoNothing: mock(() => ({
          returning: mock(() => {
            txInsertCalls.push({ table, values });
            return cutoverInsertReturning;
          }),
        })),
      }),
    })),
    update: mock((table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        txUpdateCalls.push({ table, values });
        return { where: () => Promise.resolve([]) };
      },
    })),
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => existingCutoverRows),
      })),
    })),
  };

  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: {
    ...mockDbPool,
    update: mockUpdate,
    transaction: mockTransaction,
  },
}));

const mockDecryptToken = mock((encrypted: string) => `dec(${encrypted})`);
mock.module("lib/encryption/tokenEncryption", () => ({
  encryptToken: mock((plaintext: string) => `enc(${plaintext})`),
  decryptToken: mockDecryptToken,
}));

// Revoke plumbing: capture the argument and allow forcing a throw
const revokeCalls: string[] = [];
let revokeError: Error | null = null;
const mockRevokeToken = mock((refreshToken: string) => {
  revokeCalls.push(refreshToken);
  if (revokeError) {
    return Promise.reject(revokeError);
  }
  return Promise.resolve();
});
mock.module("./quickbooksClient", () => ({
  ...realClient,
  revokeToken: mockRevokeToken,
}));

// Restore the genuine shared client after this file's tests, so its stub does
// not leak into sibling tests that exercise the real module
afterAll(() => {
  mock.module("./quickbooksClient", () => ({ ...realClient }));
});

const { runCutover, CutoverNotReconciledError } = await import("./cutover");

const ACCOUNT = {
  id: "conn-1",
  bookId: "book-1",
  provider: "quickbooks",
  refreshToken: "enc-refresh",
};

const RECON = {
  id: "recon-1",
  bookId: "book-1",
  connectedAccountId: "conn-1",
  status: "complete",
  mismatchCount: 0,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const setup = (
  overrides: {
    account?: Record<string, unknown> | null;
    recon?: Record<string, unknown> | null;
    // Rows the freshness query returns: a non-empty array means a journal
    // entry was created after the reconciliation completed (the book drifted)
    postReconEntries?: unknown[];
  } = {},
) => {
  const account =
    overrides.account === null
      ? undefined
      : { ...ACCOUNT, ...overrides.account };
  const recon =
    overrides.recon === null ? undefined : { ...RECON, ...overrides.recon };
  // The freshness query is the third select in runCutover (account, recon,
  // then post-recon journal entries); queue an empty result by default so an
  // unchanged book proceeds
  setSelectResults([
    account ? [account] : [],
    recon ? [recon] : [],
    overrides.postReconEntries ?? [],
  ]);
};

const run = () =>
  runCutover({
    bookId: "book-1",
    connectedAccountId: "conn-1",
    reconciliationId: "recon-1",
  });

const cutoverInserts = () =>
  txInsertCalls.filter((c) => c.table === quickbooksCutoverTable);
const connectedDisconnects = () =>
  txUpdateCalls.filter((c) => c.table === connectedAccountTable);

beforeEach(() => {
  resetDbMock();
  txInsertCalls.length = 0;
  txUpdateCalls.length = 0;
  revokeCalls.length = 0;
  cutoverInsertReturning = [{ id: "cutover-1" }];
  existingCutoverRows = [{ id: "cutover-existing" }];
  revokeError = null;
  mockUpdate.mockClear();
  mockTransaction.mockClear();
  mockDecryptToken.mockClear();
  mockRevokeToken.mockClear();
});

describe("runCutover", () => {
  test("happy path: reconciled cleanly inserts cutover, disconnects, revokes", async () => {
    setup();

    const result = await run();

    expect(result).toEqual({ cutoverId: "cutover-1", alreadyCutOver: false });

    const inserts = cutoverInserts();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values).toMatchObject({
      bookId: "book-1",
      connectedAccountId: "conn-1",
      reconciliationId: "recon-1",
    });

    const disconnects = connectedDisconnects();
    expect(disconnects).toHaveLength(1);
    // The disconnect also clears the stored credentials, so a later revoke
    // failure can never leave MyFi holding a live QBO credential
    expect(disconnects[0]?.values).toMatchObject({
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
    });

    // Revoke is still called with the in-memory decrypted refresh token
    // captured before the columns were nulled
    expect(revokeCalls).toEqual(["dec(enc-refresh)"]);
  });

  test("gate fail: status not complete throws and writes nothing", async () => {
    setup({ recon: { status: "running" } });

    await expect(run()).rejects.toBeInstanceOf(CutoverNotReconciledError);

    expect(cutoverInserts()).toHaveLength(0);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("gate fail: complete but mismatchCount 3 throws and writes nothing", async () => {
    setup({ recon: { mismatchCount: 3 } });

    await expect(run()).rejects.toBeInstanceOf(CutoverNotReconciledError);

    expect(cutoverInserts()).toHaveLength(0);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("freshness fail: book changed since recon throws and writes nothing", async () => {
    // Tie-out gate passes (complete, zero mismatches), but a journal entry was
    // created after the reconciliation completed, so the book has drifted and
    // the stale tie-out must not authorize a cutover
    setup({ postReconEntries: [{ id: "je-post-recon" }] });

    const error = await run().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CutoverNotReconciledError);
    expect((error as Error).message).toBe("Book changed since reconciliation");

    expect(cutoverInserts()).toHaveLength(0);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("gate error message is the fixed string, leaking no data", async () => {
    setup({ recon: { status: "failed" } });

    await expect(run()).rejects.toThrow("Book has not reconciled cleanly");
  });

  test("IDOR: account belongs to a different book throws, writes nothing", async () => {
    setup({ account: { bookId: "other-book" } });

    await expect(run()).rejects.toThrow();
    await expect(run()).rejects.not.toBeInstanceOf(CutoverNotReconciledError);

    expect(cutoverInserts()).toHaveLength(0);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("provider guard: non-quickbooks account throws, writes nothing", async () => {
    setup({ account: { provider: "plaid" } });

    await expect(run()).rejects.toThrow();

    expect(cutoverInserts()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("missing account throws, writes nothing", async () => {
    setup({ account: null });

    await expect(run()).rejects.toThrow();
    expect(cutoverInserts()).toHaveLength(0);
  });

  test("missing reconciliation run throws, writes nothing", async () => {
    setup({ recon: null });

    await expect(run()).rejects.toThrow();
    expect(cutoverInserts()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("reconciliation for a different book throws, writes nothing", async () => {
    setup({ recon: { bookId: "other-book" } });

    await expect(run()).rejects.toThrow();
    await expect(run()).rejects.not.toBeInstanceOf(CutoverNotReconciledError);
    expect(cutoverInserts()).toHaveLength(0);
  });

  test("reconciliation for a different connected account throws, writes nothing", async () => {
    setup({ recon: { connectedAccountId: "conn-other" } });

    await expect(run()).rejects.toThrow();
    expect(cutoverInserts()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("idempotent: an existing cutover returns alreadyCutOver without disconnect or revoke", async () => {
    setup();
    // The insert conflicts on the unique book id, so nothing is returned
    cutoverInsertReturning = [];

    const result = await run();

    expect(result).toEqual({
      cutoverId: "cutover-existing",
      alreadyCutOver: true,
    });
    // The insert was attempted, but the connection is not disconnected again
    expect(cutoverInserts()).toHaveLength(1);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("conflict with no existing row throws instead of returning a blank id", async () => {
    setup();
    // A conflict (no returning row) but the follow-up select finds nothing: an
    // impossible state that must fail loudly rather than return ""
    cutoverInsertReturning = [];
    existingCutoverRows = [];

    await expect(run()).rejects.toThrow(/no existing row/i);
    expect(connectedDisconnects()).toHaveLength(0);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  test("revoke failure is swallowed: cutover still succeeds, only the class is logged", async () => {
    setup();
    revokeError = new Error("boom AQAB-secret dec(enc-refresh)");
    const logged: string[] = [];
    const spy = mock((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
    const original = console.error;
    console.error = spy;

    try {
      const result = await run();

      expect(result).toEqual({ cutoverId: "cutover-1", alreadyCutOver: false });
      // The local cutover + disconnect committed regardless of the revoke
      expect(cutoverInserts()).toHaveLength(1);
      expect(connectedDisconnects()).toHaveLength(1);

      const joined = logged.join("\n");
      expect(joined).toContain("Error");
      expect(joined).not.toContain("secret");
      expect(joined).not.toContain("AQAB");
      expect(joined).not.toContain("enc-refresh");
      expect(joined).not.toContain("dec(");
    } finally {
      console.error = original;
    }
  });

  test("no refresh token on the account: cutover succeeds, revoke not called", async () => {
    setup({ account: { refreshToken: null } });

    const result = await run();

    expect(result).toEqual({ cutoverId: "cutover-1", alreadyCutOver: false });
    expect(connectedDisconnects()).toHaveLength(1);
    expect(mockRevokeToken).not.toHaveBeenCalled();
    expect(mockDecryptToken).not.toHaveBeenCalled();
  });
});
