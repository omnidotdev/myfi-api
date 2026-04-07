import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: generateSalesTaxReport } = await import("./salesTax");

const makeJurisdiction = (overrides: Record<string, unknown> = {}) => ({
  id: "jur-1",
  bookId: "book-1",
  name: "State Sales Tax",
  code: "CA",
  filingFrequency: "quarterly",
  taxPayableAccountId: "acct-tax-1",
  createdAt: "2026-01-01",
  ...overrides,
});

describe("generateSalesTaxReport", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("calculates collected, remitted, and owed", async () => {
    setSelectResults([
      [makeJurisdiction({ filingFrequency: "annually" })],
      // Single annual period query
      [{ credits: "1000.0000", debits: "400.0000" }],
    ]);

    const report = await generateSalesTaxReport({
      bookId: "book-1",
      year: 2026,
    });

    expect(report.jurisdictions).toHaveLength(1);
    const jur = report.jurisdictions[0]!;
    expect(jur.totalCollected).toBe("1000.0000");
    expect(jur.totalRemitted).toBe("400.0000");
    expect(jur.totalOwed).toBe("600.0000");
    expect(jur.periods).toHaveLength(1);
    expect(jur.periods[0]!.owed).toBe("600.0000");
  });

  test("breaks down quarterly periods", async () => {
    setSelectResults([
      [makeJurisdiction({ filingFrequency: "quarterly" })],
      // Q1-Q4 period queries
      [{ credits: "250.0000", debits: "100.0000" }],
      [{ credits: "300.0000", debits: "150.0000" }],
      [{ credits: "200.0000", debits: "50.0000" }],
      [{ credits: "400.0000", debits: "200.0000" }],
    ]);

    const report = await generateSalesTaxReport({
      bookId: "book-1",
      year: 2026,
    });

    const jur = report.jurisdictions[0]!;
    expect(jur.periods).toHaveLength(4);
    expect(jur.periods[0]!.label).toBe("Q1 2026");
    expect(jur.periods[1]!.label).toBe("Q2 2026");
    expect(jur.periods[2]!.label).toBe("Q3 2026");
    expect(jur.periods[3]!.label).toBe("Q4 2026");
  });

  test("returns zero for no transactions", async () => {
    setSelectResults([
      [makeJurisdiction({ filingFrequency: "annually" })],
      [{ credits: null, debits: null }],
    ]);

    const report = await generateSalesTaxReport({
      bookId: "book-1",
      year: 2026,
    });

    const jur = report.jurisdictions[0]!;
    expect(jur.totalCollected).toBe("0.0000");
    expect(jur.totalRemitted).toBe("0.0000");
    expect(jur.totalOwed).toBe("0.0000");
  });

  test("handles multiple jurisdictions", async () => {
    setSelectResults([
      [
        makeJurisdiction({ id: "jur-1", name: "State Tax" }),
        makeJurisdiction({
          id: "jur-2",
          name: "City Tax",
          code: "SF",
          filingFrequency: "annually",
          taxPayableAccountId: "acct-tax-2",
        }),
      ],
      // jur-1 quarterly (4 periods)
      [{ credits: "100.0000", debits: "50.0000" }],
      [{ credits: "100.0000", debits: "50.0000" }],
      [{ credits: "100.0000", debits: "50.0000" }],
      [{ credits: "100.0000", debits: "50.0000" }],
      // jur-2 annually (1 period)
      [{ credits: "500.0000", debits: "200.0000" }],
    ]);

    const report = await generateSalesTaxReport({
      bookId: "book-1",
      year: 2026,
    });

    expect(report.jurisdictions).toHaveLength(2);
    expect(report.jurisdictions[0]!.name).toBe("State Tax");
    expect(report.jurisdictions[1]!.name).toBe("City Tax");
    expect(report.jurisdictions[1]!.totalOwed).toBe("300.0000");
  });
});
