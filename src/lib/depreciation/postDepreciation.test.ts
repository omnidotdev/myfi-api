import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const mockEmitAudit = mock(() => {});
const mockCalculate = mock(() => 0);

// Transaction mock: passes a tx object with the same insert API as mockDbPool
// but tracks calls via txInsertValues
const txInsertValues = mock(
  () =>
    ({ returning: mock(() => [{ id: "entry-1" }]) }) as Record<string, unknown>,
);
const mockTransaction = mock(async (fn: (tx: unknown) => Promise<void>) => {
  const tx = {
    insert: mock(() => ({
      values: txInsertValues,
    })),
  };

  await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));
mock.module("lib/audit", () => ({
  emitAudit: mockEmitAudit,
  SYSTEM_ACTOR: { id: "system", name: "MyFi System" },
}));
mock.module("./calculate", () => ({
  calculateMonthlyDepreciation: mockCalculate,
}));

const { default: postDepreciation } = await import("./postDepreciation");

const fakeAsset = {
  id: "asset-1",
  bookId: "book-1",
  name: "Office Laptop",
  acquisitionCost: "6000.0000",
  salvageValue: "0.0000",
  usefulLifeMonths: 60,
  depreciationMethod: "straight_line",
  macrsClass: null,
  acquisitionDate: "2025-01-15",
  depreciationExpenseAccountId: "expense-1",
  accumulatedDepreciationAccountId: "accum-1",
  disposedAt: null,
};

describe("postDepreciation", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
    mockCalculate.mockClear();
    mockTransaction.mockClear();
    txInsertValues.mockClear();
  });

  test("posts depreciation for active asset", async () => {
    // Select 1: fetch assets, Select 2: idempotency check (no existing entry)
    setSelectResults([[fakeAsset], []]);
    mockCalculate.mockReturnValueOnce(500);

    const result = await postDepreciation("book-1", 2026, 3);

    expect(result).toEqual({ postedCount: 1, skippedCount: 0 });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // 3 inserts inside transaction: journal entry, journal lines, reconciliation queue
    expect(txInsertValues).toHaveBeenCalledTimes(3);
  });

  test("skips asset with zero depreciation", async () => {
    setSelectResults([[fakeAsset]]);
    mockCalculate.mockReturnValueOnce(0);

    const result = await postDepreciation("book-1", 2026, 3);

    expect(result).toEqual({ postedCount: 0, skippedCount: 1 });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(txInsertValues).not.toHaveBeenCalled();
  });

  test("skips already-posted entries (idempotent)", async () => {
    // Select 1: fetch assets, Select 2: existing entry found
    setSelectResults([[fakeAsset], [{ id: "existing-entry-1" }]]);
    mockCalculate.mockReturnValueOnce(500);

    const result = await postDepreciation("book-1", 2026, 3);

    expect(result).toEqual({ postedCount: 0, skippedCount: 1 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("handles disposed assets (empty result set)", async () => {
    setSelectResults([[]]);

    const result = await postDepreciation("book-1", 2026, 3);

    expect(result).toEqual({ postedCount: 0, skippedCount: 0 });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCalculate).not.toHaveBeenCalled();
  });

  test("emits audit event on successful post", async () => {
    setSelectResults([[fakeAsset], []]);
    mockCalculate.mockReturnValueOnce(500);

    await postDepreciation("book-1", 2026, 3);

    expect(mockEmitAudit).toHaveBeenCalledTimes(1);
    const auditArg = (mockEmitAudit.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(auditArg.type).toBe("myfi.depreciation.posted");
    expect(auditArg.organizationId).toBe("book-1");

    const resource = auditArg.resource as Record<string, unknown>;
    expect(resource.type).toBe("fixed_asset");
    expect(resource.id).toBe("asset-1");

    const data = auditArg.data as Record<string, unknown>;
    expect(data.year).toBe(2026);
    expect(data.month).toBe(3);
    expect(data.amount).toBe(500);
  });
});
