import { describe, expect, test } from "bun:test";

import calculateDelawareFranchiseTax from "./delawareFranchiseTax";

describe("calculateDelawareFranchiseTax - authorized shares method", () => {
  test("charges the $175 minimum at or below 5,000 authorized shares", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 5000,
      issuedShares: 1000,
      totalGrossAssets: 10_000,
      parValuePerShare: 0.0001,
    });
    expect(result.authorizedSharesMethod.tax).toBe(175);
  });

  test("charges $250 between 5,001 and 10,000 authorized shares", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 10_000,
      issuedShares: 1000,
      totalGrossAssets: 10_000,
      parValuePerShare: 0.0001,
    });
    expect(result.authorizedSharesMethod.tax).toBe(250);
  });

  test("adds $85 per additional 10,000 shares or part thereof", () => {
    // 10,000,000 authorized -> 250 + ceil((10,000,000 - 10,000)/10,000) * 85
    // ceil(9,990,000 / 10,000) = 999 -> 250 + 999 * 85 = 85,165
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 10_000_000,
      issuedShares: 1_000_000,
      totalGrossAssets: 100,
      parValuePerShare: 0.0001,
    });
    expect(result.authorizedSharesMethod.tax).toBe(85_165);
  });

  test("caps the authorized shares method at $200,000", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 1_000_000_000,
      issuedShares: 1,
      totalGrossAssets: 1,
      parValuePerShare: 0.0001,
    });
    expect(result.authorizedSharesMethod.tax).toBe(200_000);
  });
});

describe("calculateDelawareFranchiseTax - assumed par value capital method", () => {
  test("computes assumed par per share as gross assets over issued shares", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 1_000_000,
      issuedShares: 250_000,
      totalGrossAssets: 1_000_000,
      parValuePerShare: 1,
    });
    // assumed par = 1,000,000 / 250,000 = 4.00
    expect(result.assumedParValueCapitalMethod.assumedParPerShare).toBeCloseTo(
      4,
      6,
    );
    // capital = 4 * 1,000,000 authorized = 4,000,000 -> ceil(4M/1M)=4 -> 4 * 400 = 1,600
    expect(result.assumedParValueCapitalMethod.assumedParValueCapital).toBe(
      4_000_000,
    );
    expect(result.assumedParValueCapitalMethod.tax).toBe(1_600);
  });

  test("rounds capital up to the next whole million before applying the $400 rate", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 1_000_000,
      issuedShares: 1_000_000,
      totalGrossAssets: 1_500_000,
      parValuePerShare: 0.0001,
    });
    // assumed par = 1.5, capital = 1,500,000 -> ceil(1.5M/1M) = 2 -> 2 * 400 = 800
    expect(result.assumedParValueCapitalMethod.tax).toBe(800);
  });

  test("uses the stated par value when it exceeds the assumed par", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 1_000_000,
      issuedShares: 1_000_000,
      totalGrossAssets: 100,
      parValuePerShare: 5,
    });
    // assumed par = 0.0001 but stated par 5 is higher -> effective 5
    // capital = 5 * 1,000,000 = 5,000,000 -> 5 * 400 = 2,000
    expect(result.assumedParValueCapitalMethod.tax).toBe(2_000);
  });

  test("charges the $400 minimum for tiny asset bases", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 10_000_000,
      issuedShares: 1_000_000,
      totalGrossAssets: 100,
      parValuePerShare: 0.0001,
    });
    expect(result.assumedParValueCapitalMethod.tax).toBe(400);
  });

  test("does not divide by zero when no shares are issued", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 5000,
      issuedShares: 0,
      totalGrossAssets: 10_000,
      parValuePerShare: 0.0001,
    });
    expect(Number.isFinite(result.assumedParValueCapitalMethod.tax)).toBe(true);
    expect(result.assumedParValueCapitalMethod.tax).toBe(400);
  });
});

describe("calculateDelawareFranchiseTax - recommendation and total", () => {
  test("recommends the lesser of the two methods", () => {
    // High authorized shares makes the authorized method expensive; a small asset
    // base keeps the assumed par method near the $400 minimum.
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 10_000_000,
      issuedShares: 9_000_000,
      totalGrossAssets: 100_000,
      parValuePerShare: 0.0001,
    });
    expect(result.recommendedMethod).toBe("assumed_par_value_capital");
    expect(result.franchiseTax).toBe(result.assumedParValueCapitalMethod.tax);
    expect(result.franchiseTax).toBeLessThan(result.authorizedSharesMethod.tax);
  });

  test("adds the $50 annual report fee to the total due", () => {
    const result = calculateDelawareFranchiseTax({
      authorizedShares: 5000,
      issuedShares: 1000,
      totalGrossAssets: 10_000,
      parValuePerShare: 0.0001,
    });
    expect(result.annualReportFee).toBe(50);
    expect(result.totalDue).toBe(result.franchiseTax + 50);
  });
});
