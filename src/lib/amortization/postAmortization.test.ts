import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  mockUpdateWhere,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

const mockEmitAudit = mock(() => {});

mock.module("lib/db/db", () => ({
  dbPool: mockDbPool,
}));
mock.module("lib/audit", () => ({
  emitAudit: mockEmitAudit,
  SYSTEM_ACTOR: { id: "system", name: "MyFi System" },
}));

const { default: postAmortization } = await import("./postAmortization");

const fakeLoan = {
  id: "loan-1",
  bookId: "book-1",
  name: "Office Mortgage",
  liabilityAccountId: "liability-1",
  interestAccountId: "interest-1",
  paymentAccountId: "payment-1",
  originalPrincipal: "100000.0000",
  annualRate: "6.0000",
  termMonths: 360,
  startDate: "2025-01-01",
  paymentDay: 1,
  paymentAmount: "599.5500",
  extraPrincipal: "0.0000",
  status: "active",
  notes: null,
};

const fakeEntry = {
  id: "entry-1",
  loanId: "loan-1",
  sequenceNumber: 3,
  dueDate: "2025-03-01",
  paymentAmount: "599.5500",
  principalAmount: "105.5500",
  interestAmount: "494.0000",
  extraPrincipal: "0.0000",
  balanceAfter: "99789.9000",
  journalEntryId: null,
  status: "scheduled",
};

describe("postAmortization", () => {
  beforeEach(() => {
    resetDbMock();
    mockEmitAudit.mockClear();
  });

  test("posts amortization entry and creates journal entry with 3 lines", async () => {
    // Select 1: loans, Select 2: scheduled entries, Select 3: idempotency (empty)
    setSelectResults([[fakeLoan], [fakeEntry], []]);
    setInsertReturningData([{ id: "je-1" }]);

    const result = await postAmortization("book-1", 2025, 3);

    expect(result).toEqual({ postedCount: 1, skippedCount: 0 });
    // 3 inserts (journal entry, journal lines, reconciliation queue) + 1 update (amortization entry status)
    expect(mockInsertValues).toHaveBeenCalledTimes(3);
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  test("skips entries already posted (idempotency via sourceReferenceId)", async () => {
    // Select 1: loans, Select 2: scheduled entries, Select 3: existing journal entry
    setSelectResults([[fakeLoan], [fakeEntry], [{ id: "existing-je" }]]);

    const result = await postAmortization("book-1", 2025, 3);

    expect(result).toEqual({ postedCount: 0, skippedCount: 1 });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  test("skips when no scheduled entries for the period", async () => {
    // Select 1: loans, Select 2: no scheduled entries
    setSelectResults([[fakeLoan], []]);

    const result = await postAmortization("book-1", 2025, 3);

    expect(result).toEqual({ postedCount: 0, skippedCount: 0 });
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockEmitAudit).not.toHaveBeenCalled();
  });

  test("emits audit event on post", async () => {
    setSelectResults([[fakeLoan], [fakeEntry], []]);
    setInsertReturningData([{ id: "je-1" }]);

    await postAmortization("book-1", 2025, 3);

    expect(mockEmitAudit).toHaveBeenCalledTimes(1);
    const auditArg = (mockEmitAudit.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(auditArg.type).toBe("myfi.loan.payment_posted");
    expect(auditArg.organizationId).toBe("book-1");

    const resource = auditArg.resource as Record<string, unknown>;
    expect(resource.type).toBe("loan");
    expect(resource.id).toBe("loan-1");

    const data = auditArg.data as Record<string, unknown>;
    expect(data.sequenceNumber).toBe(3);
    expect(data.principal).toBe("105.5500");
    expect(data.interest).toBe("494.0000");
    expect(data.year).toBe(2025);
    expect(data.month).toBe(3);
  });
});
