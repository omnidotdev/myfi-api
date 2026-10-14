import { describe, expect, test } from "bun:test";

import { computeSelfEmploymentTaxes } from "./quarterlyEstimates";

describe("computeSelfEmploymentTaxes", () => {
  test("applies SE tax and income tax net of the standard deduction (2025)", () => {
    const { seTax, incomeTax, totalTax } = computeSelfEmploymentTaxes({
      netIncome: 50_000,
      year: 2025,
    });
    // SE tax: 50000 * 0.9235 = 46175; SS 46175*0.124 + Medicare 46175*0.029
    expect(seTax).toBeCloseTo(7064.775, 3);
    // Taxable: 50000 - seTax/2 - 15750 std deduction = 30717.61
    // Tax: 10% of 11925 + 12% of the remainder
    expect(incomeTax).toBeCloseTo(3447.61, 2);
    expect(totalTax).toBeCloseTo(seTax + incomeTax, 2);
  });

  test("standard deduction can zero out the income tax (not the SE tax)", () => {
    // Earlier code omitted the standard deduction and would have taxed most of
    // this income; after the deduction, taxable income is zero
    const { seTax, incomeTax } = computeSelfEmploymentTaxes({
      netIncome: 15_000,
      year: 2025,
    });
    expect(seTax).toBeGreaterThan(0);
    expect(incomeTax).toBe(0);
  });

  test("caps Social Security at the year's wage base (2025 = 176,100)", () => {
    const { seTax } = computeSelfEmploymentTaxes({
      netIncome: 300_000,
      year: 2025,
    });
    // SS capped at 176100*0.124 = 21836.40; Medicare on full 277050*0.029
    expect(seTax).toBeCloseTo(21_836.4 + 277_050 * 0.029, 2);
  });

  test("uses 2026 constants and differs from 2025", () => {
    const y2025 = computeSelfEmploymentTaxes({ netIncome: 50_000, year: 2025 });
    const y2026 = computeSelfEmploymentTaxes({ netIncome: 50_000, year: 2026 });
    // Different standard deduction and brackets -> different income tax
    expect(y2026.incomeTax).not.toBeCloseTo(y2025.incomeTax, 2);
    expect(y2026.incomeTax).toBeCloseTo(3396.11, 2);
  });

  test("an unknown future year falls back to the latest known year (2026)", () => {
    const future = computeSelfEmploymentTaxes({
      netIncome: 50_000,
      year: 2030,
    });
    const y2026 = computeSelfEmploymentTaxes({ netIncome: 50_000, year: 2026 });
    expect(future.totalTax).toBeCloseTo(y2026.totalTax, 2);
  });
});
