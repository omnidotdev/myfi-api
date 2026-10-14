import { describe, expect, test } from "bun:test";

import { formatReportCurrency } from "./formatReportCurrency";

describe("formatReportCurrency", () => {
  test("formats a positive amount", () => {
    expect(formatReportCurrency("1234.5")).toBe("$1,234.50");
  });

  test("wraps a negative amount in accounting parentheses (keeps the sign)", () => {
    // The sign is the single most important fact on a financial statement; a
    // loss must never render identically to a profit
    expect(formatReportCurrency("-1234.5")).toBe("($1,234.50)");
  });

  test("formats zero without a spurious negative", () => {
    expect(formatReportCurrency("0")).toBe("$0.00");
  });

  test("treats a value that rounds to zero as non-negative", () => {
    expect(formatReportCurrency("-0.001")).toBe("$0.00");
  });

  test("defaults a non-numeric input to zero", () => {
    expect(formatReportCurrency("")).toBe("$0.00");
  });
});
