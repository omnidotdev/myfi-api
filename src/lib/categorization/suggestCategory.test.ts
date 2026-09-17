import { describe, expect, test } from "bun:test";

import {
  buildAccountList,
  buildPrompt,
  validateSuggestion,
} from "./suggestCategory";

import type { SuggestAccount } from "./suggestCategory";

const accounts: SuggestAccount[] = [
  {
    id: "a1",
    code: "6000",
    name: "Office Supplies",
    type: "expense",
    subType: null,
  },
  { id: "a2", code: "1000", name: "Checking", type: "asset", subType: "bank" },
];

describe("buildAccountList / buildPrompt", () => {
  test("includes account ids, names, and the transaction", () => {
    const prompt = buildPrompt(accounts, {
      description: "Staples",
      amount: 42.5,
      date: "2026-03-01",
    });
    expect(prompt).toContain("id=a1");
    expect(prompt).toContain("Office Supplies");
    expect(prompt).toContain("Staples");
    expect(prompt).toContain("42.50");
  });

  test("buildAccountList renders type and subtype", () => {
    expect(buildAccountList(accounts)).toContain("Checking (asset/bank)");
  });
});

describe("validateSuggestion", () => {
  test("returns a typed suggestion with resolved names", () => {
    const s = validateSuggestion(
      {
        debitAccountId: "a1",
        creditAccountId: "a2",
        confidence: 0.9,
        rationale: "Office purchase paid from checking.",
      },
      accounts,
    );
    expect(s).not.toBeNull();
    expect(s?.debitAccountName).toBe("Office Supplies");
    expect(s?.creditAccountName).toBe("Checking");
    expect(s?.confidence).toBe(0.9);
  });

  test("rejects unknown account ids (no hallucinated accounts)", () => {
    expect(
      validateSuggestion(
        {
          debitAccountId: "a1",
          creditAccountId: "nope",
          confidence: 1,
          rationale: "x",
        },
        accounts,
      ),
    ).toBeNull();
  });

  test("rejects debit == credit", () => {
    expect(
      validateSuggestion(
        {
          debitAccountId: "a1",
          creditAccountId: "a1",
          confidence: 1,
          rationale: "x",
        },
        accounts,
      ),
    ).toBeNull();
  });

  test("rejects malformed input", () => {
    expect(validateSuggestion(null, accounts)).toBeNull();
    expect(validateSuggestion({ debitAccountId: "a1" }, accounts)).toBeNull();
  });

  test("clamps out-of-range or non-numeric confidence", () => {
    const hi = validateSuggestion(
      {
        debitAccountId: "a1",
        creditAccountId: "a2",
        confidence: 5,
        rationale: "x",
      },
      accounts,
    );
    expect(hi?.confidence).toBe(1);
    const bad = validateSuggestion(
      {
        debitAccountId: "a1",
        creditAccountId: "a2",
        confidence: "NaN",
        rationale: "x",
      },
      accounts,
    );
    expect(bad?.confidence).toBe(0);
  });
});
