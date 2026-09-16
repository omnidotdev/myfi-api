import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: getVendorSpend } = await import("./vendorSpend");

const row = (
  vendorId: string | null,
  vendorName: string | null,
  month: string,
  debit: string,
) => ({ vendorId, vendorName, month, debitTotal: debit, creditTotal: "0" });

describe("getVendorSpend", () => {
  beforeEach(() => resetDbMock());

  test("pivots rows into a vendor x month matrix with totals", async () => {
    setSelectResults([
      [
        row("v-a", "Acme", "2026-01", "100"),
        row("v-a", "Acme", "2026-02", "100"),
        row("v-a", "Acme", "2026-03", "100"),
        row("v-b", "Bolt", "2026-01", "50"),
        row(null, null, "2026-02", "20"),
      ],
    ]);

    const result = await getVendorSpend({
      bookId: "b1",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });

    expect(result.months).toEqual(["2026-01", "2026-02", "2026-03"]);
    // sorted by total desc
    expect(result.vendors.map((v) => v.vendorName)).toEqual([
      "Acme",
      "Bolt",
      "(Unassigned)",
    ]);
    expect(result.vendors[0]?.total).toBe("300.0000");
    expect(result.vendors[0]?.isRecurring).toBe(true);
    expect(result.vendors[1]?.isRecurring).toBe(false);
    expect(result.vendors[0]?.monthly["2026-02"]).toBe("100.0000");
    expect(result.monthlyTotals).toEqual({
      "2026-01": "150.0000",
      "2026-02": "120.0000",
      "2026-03": "100.0000",
    });
    expect(result.grandTotal).toBe("370.0000");
  });

  test("nets debits against credits and drops zero-net vendors", async () => {
    setSelectResults([
      [
        {
          vendorId: "v-a",
          vendorName: "Acme",
          month: "2026-01",
          debitTotal: "100",
          creditTotal: "100",
        },
        {
          vendorId: "v-b",
          vendorName: "Bolt",
          month: "2026-01",
          debitTotal: "80",
          creditTotal: "30",
        },
      ],
    ]);

    const result = await getVendorSpend({
      bookId: "b1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.vendors.map((v) => v.vendorName)).toEqual(["Bolt"]);
    expect(result.vendors[0]?.total).toBe("50.0000");
    expect(result.grandTotal).toBe("50.0000");
  });
});
