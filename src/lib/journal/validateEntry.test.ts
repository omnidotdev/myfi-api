import { describe, expect, test } from "bun:test";

import { validateJournalLines } from "./validateEntry";

describe("validateJournalLines", () => {
  test("accepts a balanced two-line entry", () => {
    expect(() =>
      validateJournalLines([{ debit: "100.00" }, { credit: "100.00" }]),
    ).not.toThrow();
  });

  test("accepts a balanced multi-line entry", () => {
    expect(() =>
      validateJournalLines([
        { debit: "60.00" },
        { debit: "40.00" },
        { credit: "100.00" },
      ]),
    ).not.toThrow();
  });

  test("is exact in ten-thousandths (no float drift)", () => {
    expect(() =>
      validateJournalLines([
        { debit: "0.10" },
        { debit: "0.20" },
        { credit: "0.30" },
      ]),
    ).not.toThrow();
  });

  test("rejects fewer than two lines", () => {
    expect(() => validateJournalLines([{ debit: "10" }])).toThrow(
      /at least two lines/,
    );
  });

  test("rejects an unbalanced entry", () => {
    expect(() =>
      validateJournalLines([{ debit: "100" }, { credit: "90" }]),
    ).toThrow(/does not balance/);
  });

  test("rejects a line with both a debit and a credit", () => {
    expect(() =>
      validateJournalLines([{ debit: "10", credit: "10" }, { credit: "10" }]),
    ).toThrow(/both a debit and a credit/);
  });

  test("rejects a line with neither a debit nor a credit", () => {
    expect(() =>
      validateJournalLines([{ debit: "10" }, {}, { credit: "10" }]),
    ).toThrow(/needs a debit or a credit/);
  });

  test("rejects negative amounts", () => {
    expect(() =>
      validateJournalLines([{ debit: "-10" }, { credit: "-10" }]),
    ).toThrow(/cannot be negative/);
  });

  test("rejects an all-zero entry", () => {
    expect(() =>
      validateJournalLines([{ debit: "0" }, { credit: "0" }]),
    ).toThrow(/needs a debit or a credit/);
  });
});
