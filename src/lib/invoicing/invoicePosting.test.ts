import { describe, expect, test } from "bun:test";

import {
  buildInvoicePostings,
  computeInvoiceTotals,
  computeLineAmount,
  computeLineTax,
} from "./invoicePosting";

import type { PricedLine } from "./invoicePosting";

describe("computeLineAmount", () => {
  test("multiplies quantity by unit price at 4-decimal scale", () => {
    expect(computeLineAmount(3, 25)).toBe(75);
    expect(computeLineAmount(2.5, 10.1)).toBe(25.25);
  });
});

describe("computeLineTax", () => {
  test("applies a fractional rate to the amount", () => {
    expect(computeLineTax(100, 0.0825)).toBe(8.25);
    // rounds to the nearest ten-thousandth
    expect(computeLineTax(99.99, 0.0825)).toBe(8.2492);
  });
});

describe("computeInvoiceTotals", () => {
  test("sums subtotal, tax, and total exactly", () => {
    const lines: PricedLine[] = [
      { amount: 100, taxAmount: 8.25, incomeAccountId: "rev" },
      { amount: 50, taxAmount: 0, incomeAccountId: "rev" },
    ];
    expect(computeInvoiceTotals(lines)).toEqual({
      subtotal: 150,
      taxAmount: 8.25,
      total: 158.25,
    });
  });

  test("has no float drift (0.1 + 0.2)", () => {
    const lines: PricedLine[] = [
      { amount: 0.1, taxAmount: 0, incomeAccountId: "rev" },
      { amount: 0.2, taxAmount: 0, incomeAccountId: "rev" },
    ];
    expect(computeInvoiceTotals(lines).subtotal).toBe(0.3);
  });
});

describe("buildInvoicePostings", () => {
  test("debits AR for the total and credits income plus tax", () => {
    const postings = buildInvoicePostings({
      arAccountId: "ar",
      lines: [
        {
          amount: 100,
          taxAmount: 8.25,
          incomeAccountId: "sales",
          taxPayableAccountId: "tax",
        },
      ],
    });

    expect(postings).toEqual([
      { accountId: "ar", debit: 108.25, credit: 0 },
      { accountId: "sales", debit: 0, credit: 100 },
      { accountId: "tax", debit: 0, credit: 8.25 },
    ]);
  });

  test("consolidates multiple lines on the same income account", () => {
    const postings = buildInvoicePostings({
      arAccountId: "ar",
      lines: [
        { amount: 100, taxAmount: 0, incomeAccountId: "sales" },
        { amount: 40, taxAmount: 0, incomeAccountId: "sales" },
        { amount: 10, taxAmount: 0, incomeAccountId: "service" },
      ],
    });

    const sales = postings.find((p) => p.accountId === "sales");
    expect(sales).toEqual({ accountId: "sales", debit: 0, credit: 140 });
    expect(postings.find((p) => p.accountId === "ar")?.debit).toBe(150);
  });

  test("always balances debits and credits", () => {
    const postings = buildInvoicePostings({
      arAccountId: "ar",
      lines: [
        {
          amount: 33.33,
          taxAmount: 2.75,
          incomeAccountId: "sales",
          taxPayableAccountId: "tax",
        },
        { amount: 66.67, taxAmount: 0, incomeAccountId: "service" },
      ],
    });
    const debit = postings.reduce((s, p) => s + p.debit, 0);
    const credit = postings.reduce((s, p) => s + p.credit, 0);
    expect(debit).toBeCloseTo(credit, 4);
  });

  test("throws when a taxed line has no tax payable account", () => {
    expect(() =>
      buildInvoicePostings({
        arAccountId: "ar",
        lines: [{ amount: 100, taxAmount: 5, incomeAccountId: "sales" }],
      }),
    ).toThrow(/tax payable account/);
  });

  test("throws on an empty invoice", () => {
    expect(() =>
      buildInvoicePostings({ arAccountId: "ar", lines: [] }),
    ).toThrow(/no lines/);
  });
});
