import { describe, expect, test } from "bun:test";

import { calculateMonthlyDepreciation } from "./calculate";

import type { DepreciationInput } from "./calculate";

const base: DepreciationInput = {
  acquisitionCost: 12_000,
  salvageValue: 0,
  usefulLifeMonths: 12,
  depreciationMethod: "straight_line",
  macrsClass: null,
  acquisitionDate: "2025-01-01",
  targetYear: 2025,
  targetMonth: 1,
};

describe("calculateMonthlyDepreciation", () => {
  describe("straight-line", () => {
    test("basic monthly amount", () => {
      const result = calculateMonthlyDepreciation(base);

      expect(result).toBeCloseTo(1000, 2);
    });

    test("with salvage value", () => {
      const result = calculateMonthlyDepreciation({
        ...base,
        salvageValue: 2_000,
        usefulLifeMonths: 10,
      });

      expect(result).toBeCloseTo(1000, 2);
    });

    test("returns 0 before acquisition", () => {
      const result = calculateMonthlyDepreciation({
        ...base,
        acquisitionDate: "2025-06-01",
        targetMonth: 3,
      });

      expect(result).toBe(0);
    });

    test("returns 0 after useful life", () => {
      const result = calculateMonthlyDepreciation({
        ...base,
        targetYear: 2026,
        targetMonth: 1,
      });

      expect(result).toBe(0);
    });

    test("returns 0 when cost equals salvage", () => {
      const result = calculateMonthlyDepreciation({
        ...base,
        salvageValue: 12_000,
      });

      expect(result).toBe(0);
    });
  });

  describe("MACRS", () => {
    const macrsBase: DepreciationInput = {
      acquisitionCost: 10_000,
      salvageValue: 0,
      usefulLifeMonths: 60,
      depreciationMethod: "macrs",
      macrsClass: "5",
      acquisitionDate: "2025-01-01",
      targetYear: 2025,
      targetMonth: 1,
    };

    test("5-year class, year 1", () => {
      const result = calculateMonthlyDepreciation(macrsBase);

      // 20% of 10,000 = 2,000 annual, / 12 = 166.67
      expect(result).toBeCloseTo(166.67, 2);
    });

    test("5-year class, year 2", () => {
      const result = calculateMonthlyDepreciation({
        ...macrsBase,
        targetYear: 2026,
        targetMonth: 1,
      });

      // 32% of 10,000 = 3,200 annual, / 12 = 266.67
      expect(result).toBeCloseTo(266.67, 2);
    });

    test("returns 0 for unknown class", () => {
      const result = calculateMonthlyDepreciation({
        ...macrsBase,
        macrsClass: "99",
      });

      expect(result).toBe(0);
    });

    test("returns 0 after recovery period", () => {
      const result = calculateMonthlyDepreciation({
        ...macrsBase,
        targetYear: 2031,
        targetMonth: 6,
      });

      expect(result).toBe(0);
    });

    test("returns 0 before acquisition", () => {
      const result = calculateMonthlyDepreciation({
        ...macrsBase,
        acquisitionDate: "2025-06-01",
        targetMonth: 3,
      });

      expect(result).toBe(0);
    });
  });
});
