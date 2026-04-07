import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setSelectResults,
} from "lib/test/mockDb";

const mockFetchPayrolls = mock(() => Promise.resolve([]));
mock.module("./gustoClient", () => ({
  fetchPayrolls: mockFetchPayrolls,
  refreshToken: mock(() =>
    Promise.resolve({ access_token: "new", refresh_token: "new" }),
  ),
}));

const mockEmitAudit = mock(() => {});
mock.module("lib/audit", () => ({
  emitAudit: mockEmitAudit,
  SYSTEM_ACTOR: { id: "system", name: "MyFi System" },
}));

mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: mock((v: string) => v),
  encryptToken: mock((v: string) => v),
}));

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: syncPayroll } = await import("./syncPayroll");

const baseConnection = {
  id: "conn-1",
  bookId: "book-1",
  accessToken: "encrypted-access",
  refreshToken: "encrypted-refresh",
  companyId: "company-1",
  lastSyncedAt: null,
};

const makePayroll = (uuid: string, checkDate: string) => ({
  payroll_uuid: uuid,
  check_date: checkDate,
  totals: {
    gross_pay: "5000.00",
    employer_taxes: "400.00",
    net_pay: "3800.00",
    employee_taxes: "600.00",
    employee_benefits_deductions: "200.00",
  },
});

const allMappings = [
  {
    eventType: "payroll_gross_wages",
    bookId: "book-1",
    debitAccountId: "acct-gross",
    creditAccountId: null,
  },
  {
    eventType: "payroll_employer_tax",
    bookId: "book-1",
    debitAccountId: "acct-er-tax",
    creditAccountId: null,
  },
  {
    eventType: "payroll_net_pay",
    bookId: "book-1",
    debitAccountId: null,
    creditAccountId: "acct-net",
  },
  {
    eventType: "payroll_employee_tax",
    bookId: "book-1",
    debitAccountId: null,
    creditAccountId: "acct-ee-tax",
  },
  {
    eventType: "payroll_benefits",
    bookId: "book-1",
    debitAccountId: null,
    creditAccountId: "acct-benefits",
  },
];

describe("syncPayroll", () => {
  beforeEach(() => {
    resetDbMock();
    mockFetchPayrolls.mockClear();
    mockEmitAudit.mockClear();
    // Make insert().values() return an object with returning()
    mockInsertValues.mockImplementation(
      () =>
        ({
          returning: mock(() => [{ id: "entry-1" }]),
        }) as Record<string, unknown>,
    );
  });

  test("syncs new payroll run", async () => {
    const payroll = makePayroll("pr-1", "2026-03-15");
    mockFetchPayrolls.mockResolvedValueOnce([payroll] as never);

    // Select 1: book lookup
    // Select 2: account mappings
    // Select 3: idempotency check (no existing entry)
    setSelectResults([[{ organizationId: "org-1" }], allMappings, []]);

    const result = await syncPayroll(baseConnection);

    expect(result.syncedCount).toBe(1);
    expect(result.skippedCount).toBe(0);

    // 3 inserts: journal entry, journal lines, reconciliation queue
    expect(mockInsertValues).toHaveBeenCalledTimes(3);
  });

  test("skips already-synced payroll (idempotent)", async () => {
    const payroll = makePayroll("pr-1", "2026-03-15");
    mockFetchPayrolls.mockResolvedValueOnce([payroll] as never);

    // Select 1: book lookup
    // Select 2: account mappings
    // Select 3: idempotency check (existing entry found)
    setSelectResults([
      [{ organizationId: "org-1" }],
      allMappings,
      [{ id: "existing-entry-1" }],
    ]); // prettier-ignore

    const result = await syncPayroll(baseConnection);

    expect(result.syncedCount).toBe(0);
    expect(result.skippedCount).toBe(1);

    // Only the final update (lastSyncedAt) happens, no inserts for journal entries
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("skips components without account mappings", async () => {
    const payroll = makePayroll("pr-1", "2026-03-15");
    mockFetchPayrolls.mockResolvedValueOnce([payroll] as never);

    // Only provide mappings for gross wages and net pay (2 of 5 components)
    const partialMappings = allMappings.filter(
      (m) =>
        m.eventType === "payroll_gross_wages" ||
        m.eventType === "payroll_net_pay",
    );

    setSelectResults([[{ organizationId: "org-1" }], partialMappings, []]);

    const result = await syncPayroll(baseConnection);

    expect(result.syncedCount).toBe(1);

    // Insert 1: journal entry (returning), Insert 2: journal lines, Insert 3: reconciliation queue
    expect(mockInsertValues).toHaveBeenCalledTimes(3);

    // Verify journal lines insert was called with only 2 lines (mapped components)
    const linesInsertCall = mockInsertValues.mock.calls[1] as unknown[];
    const linesArg = linesInsertCall[0] as Array<Record<string, unknown>>;
    expect(linesArg).toHaveLength(2);
  });

  test("emits audit event with correct type", async () => {
    const payroll = makePayroll("pr-1", "2026-03-15");
    mockFetchPayrolls.mockResolvedValueOnce([payroll] as never);

    setSelectResults([[{ organizationId: "org-1" }], allMappings, []]);

    await syncPayroll(baseConnection);

    expect(mockEmitAudit).toHaveBeenCalledTimes(1);
    const auditArg = (mockEmitAudit.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(auditArg.type).toBe("myfi.payroll.synced");
    expect(auditArg.organizationId).toBe("org-1");

    const resource = auditArg.resource as Record<string, unknown>;
    expect(resource.type).toBe("payroll_connection");
    expect(resource.id).toBe("conn-1");

    const data = auditArg.data as Record<string, unknown>;
    expect(data.payrollUuid).toBe("pr-1");
    expect(data.checkDate).toBe("2026-03-15");
    expect(data.linesCreated).toBe(5);
  });

  test("handles empty payroll list", async () => {
    mockFetchPayrolls.mockResolvedValueOnce([] as never);

    // Select 1: book lookup
    // Select 2: account mappings
    setSelectResults([[{ organizationId: "org-1" }], allMappings]);

    const result = await syncPayroll(baseConnection);

    expect(result.syncedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(mockEmitAudit).not.toHaveBeenCalled();
  });
});
