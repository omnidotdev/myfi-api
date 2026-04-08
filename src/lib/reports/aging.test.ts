import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: generateAgingReport } = await import("./aging");

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  debit: "100.0000",
  credit: "0.0000",
  entryDate: "2026-03-15T00:00:00.000Z",
  vendorId: "vendor-1",
  vendorName: "Acme Corp",
  ...overrides,
});

describe("generateAgingReport", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("places amounts in correct aging buckets", async () => {
    setSelectResults([
      [
        // Current (0 days, same date as asOfDate)
        makeRow({
          entryDate: "2026-04-01T00:00:00.000Z",
          debit: "100.0000",
          credit: "0.0000",
        }),
        // 1-30 days (15 days ago)
        makeRow({
          entryDate: "2026-03-17T00:00:00.000Z",
          debit: "200.0000",
          credit: "0.0000",
        }),
        // 31-60 days (45 days ago)
        makeRow({
          entryDate: "2026-02-15T00:00:00.000Z",
          debit: "300.0000",
          credit: "0.0000",
        }),
        // 61-90 days (75 days ago)
        makeRow({
          entryDate: "2026-01-16T00:00:00.000Z",
          debit: "400.0000",
          credit: "0.0000",
        }),
        // 90+ days (120 days ago)
        makeRow({
          entryDate: "2025-12-02T00:00:00.000Z",
          debit: "500.0000",
          credit: "0.0000",
        }),
      ],
    ]);

    const report = await generateAgingReport({
      bookId: "book-1",
      asOfDate: "2026-04-01T00:00:00.000Z",
      accountSubType: "accounts_payable",
    });

    expect(report.reportType).toBe("ap");
    expect(report.vendors).toHaveLength(1);

    const vendor = report.vendors[0]!;
    expect(vendor.vendorName).toBe("Acme Corp");
    expect(vendor.current).toBe("100.0000");
    expect(vendor.days1to30).toBe("200.0000");
    expect(vendor.days31to60).toBe("300.0000");
    expect(vendor.days61to90).toBe("400.0000");
    expect(vendor.over90).toBe("500.0000");
    expect(vendor.total).toBe("1500.0000");

    expect(report.totals.total).toBe("1500.0000");
  });

  test("filters out vendors with zero balance", async () => {
    setSelectResults([[makeRow({ debit: "100.0000", credit: "100.0000" })]]);

    const report = await generateAgingReport({
      bookId: "book-1",
      asOfDate: "2026-04-01T00:00:00.000Z",
      accountSubType: "accounts_receivable",
    });

    expect(report.reportType).toBe("ar");
    expect(report.vendors).toHaveLength(0);
    expect(report.totals.total).toBe("0.0000");
  });

  test("groups by vendor", async () => {
    setSelectResults([
      [
        makeRow({
          vendorId: "v-1",
          vendorName: "Alpha Inc",
          debit: "100.0000",
          credit: "0.0000",
          entryDate: "2026-03-25T00:00:00.000Z",
        }),
        makeRow({
          vendorId: "v-2",
          vendorName: "Beta LLC",
          debit: "200.0000",
          credit: "0.0000",
          entryDate: "2026-03-25T00:00:00.000Z",
        }),
      ],
    ]);

    const report = await generateAgingReport({
      bookId: "book-1",
      asOfDate: "2026-04-01T00:00:00.000Z",
      accountSubType: "accounts_payable",
    });

    expect(report.vendors).toHaveLength(2);
    const names = report.vendors.map((v) => v.vendorName);
    expect(names).toContain("Alpha Inc");
    expect(names).toContain("Beta LLC");
  });

  test("returns empty report with no data", async () => {
    setSelectResults([[]]);

    const report = await generateAgingReport({
      bookId: "book-1",
      asOfDate: "2026-04-01T00:00:00.000Z",
      accountSubType: "accounts_payable",
    });

    expect(report.vendors).toHaveLength(0);
    expect(report.totals.current).toBe("0.0000");
    expect(report.totals.total).toBe("0.0000");
    expect(report.generatedAt).toBeDefined();
  });

  test("handles null vendorId gracefully", async () => {
    setSelectResults([
      [
        makeRow({
          vendorId: null,
          vendorName: null,
          debit: "50.0000",
          credit: "0.0000",
          entryDate: "2026-03-30T00:00:00.000Z",
        }),
      ],
    ]);

    const report = await generateAgingReport({
      bookId: "book-1",
      asOfDate: "2026-04-01T00:00:00.000Z",
      accountSubType: "accounts_payable",
    });

    expect(report.vendors).toHaveLength(1);
    expect(report.vendors[0]!.vendorId).toBeNull();
    expect(report.vendors[0]!.vendorName).toBe("Unknown");
  });
});
