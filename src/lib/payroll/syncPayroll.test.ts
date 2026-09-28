import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertOnConflict,
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
    // Gross must equal net + employee withholdings (3800 + 600 + 200); employer
    // taxes are separate and post as their own expense/liability pair
    gross_pay: "4600.00",
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
    creditAccountId: "acct-er-tax-liab",
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
    mockInsertValues.mockImplementation(() => ({
      returning: mock(() => [{ id: "entry-1" }]),
      onConflictDoUpdate: mockInsertOnConflict,
    }));
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

  test("skips a payroll whose mapped lines don't balance", async () => {
    const payroll = makePayroll("pr-1", "2026-03-15");
    mockFetchPayrolls.mockResolvedValueOnce([payroll] as never);

    // Only gross wages + net pay mapped: gross (4600) debit vs net (3800)
    // credit is unbalanced, so the payroll must be skipped, not posted
    const partialMappings = allMappings.filter(
      (m) =>
        m.eventType === "payroll_gross_wages" ||
        m.eventType === "payroll_net_pay",
    );

    setSelectResults([[{ organizationId: "org-1" }], partialMappings, []]);

    const result = await syncPayroll(baseConnection);

    expect(result.syncedCount).toBe(0);
    expect(result.skippedCount).toBe(1);

    // No journal entry, lines, or queue rows are inserted for a skipped payroll
    expect(mockInsertValues).not.toHaveBeenCalled();
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
    // 6 lines: gross debit, employer-tax debit + credit (pair), net, employee
    // tax, and benefits credits
    expect(data.linesCreated).toBe(6);
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
