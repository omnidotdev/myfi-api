import { describe, expect, test } from "bun:test";

import { compareTotal, mergeComparative } from "./comparativeMerge";

const line = (accountId: string, netAmount: string) => ({
  accountId,
  accountName: `Acct ${accountId}`,
  accountType: "revenue",
  subType: null,
  accountCode: null,
  netAmount,
});

describe("mergeComparative", () => {
  test("pairs accounts and computes variance and percent", () => {
    const rows = mergeComparative(
      [line("a", "150"), line("b", "50")],
      [line("a", "100"), line("b", "50")],
      (l) => l.netAmount,
    );
    const a = rows.find((r) => r.accountId === "a");
    expect(a).toMatchObject({
      current: "150.00",
      prior: "100.00",
      variance: "50.00",
      variancePct: "50.0",
    });
    const b = rows.find((r) => r.accountId === "b");
    expect(b).toMatchObject({ variance: "0.00", variancePct: "0.0" });
  });

  test("includes accounts present in only one period", () => {
    const rows = mergeComparative(
      [line("a", "100")],
      [line("z", "80")],
      (l) => l.netAmount,
    );
    expect(rows.find((r) => r.accountId === "a")).toMatchObject({
      current: "100.00",
      prior: "0.00",
    });
    expect(rows.find((r) => r.accountId === "z")).toMatchObject({
      current: "0.00",
      prior: "80.00",
    });
  });

  test("variancePct is null when prior is zero", () => {
    const rows = mergeComparative([line("a", "100")], [], (l) => l.netAmount);
    expect(rows[0].variancePct).toBeNull();
  });
});

describe("compareTotal", () => {
  test("computes variance and percent", () => {
    expect(compareTotal("120", "100")).toEqual({
      current: "120.00",
      prior: "100.00",
      variance: "20.00",
      variancePct: "20.0",
    });
  });
  test("null percent when prior is zero", () => {
    expect(compareTotal("120", "0").variancePct).toBeNull();
  });
});
