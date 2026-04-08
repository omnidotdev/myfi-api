import { describe, expect, test } from "bun:test";

import { hashTransaction } from "./importTransactions";

describe("hashTransaction", () => {
  test("generates consistent hash for same transaction", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-15", 45, "Grocery Store");
    expect(hash1).toBe(hash2);
  });

  test("generates different hashes for different transactions", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-16", 45, "Grocery Store");
    const hash3 = hashTransaction("2026-03-15", 50, "Grocery Store");
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test("normalizes memo whitespace and casing", () => {
    const hash1 = hashTransaction("2026-03-15", 45, "Grocery Store");
    const hash2 = hashTransaction("2026-03-15", 45, "  grocery store  ");
    expect(hash1).toBe(hash2);
  });
});
