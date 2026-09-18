import { describe, expect, test } from "bun:test";

import { summarizeRdExpenses } from "./rdCredit";

const row = (
  over: Partial<{ category: string; amount: string; isForeign: boolean }>,
) => ({
  category: "wages",
  amount: "100.00",
  isForeign: false,
  ...over,
});

describe("summarizeRdExpenses", () => {
  test("qualifies wages at 100%", () => {
    const result = summarizeRdExpenses(
      [row({ category: "wages", amount: "1000.00" })],
      { bookId: "book-1", year: 2025 },
    );
    const wages = result.domestic.byCategory.find(
      (c) => c.category === "wages",
    );
    expect(wages?.rawAmount).toBe("1000.00");
    expect(wages?.qualifiedAmount).toBe("1000.00");
    expect(result.domestic.totalQualifiedExpenses).toBe("1000.00");
  });

  test("haircuts contract research to 65%", () => {
    const result = summarizeRdExpenses(
      [row({ category: "contract_research", amount: "1000.00" })],
      { bookId: "book-1", year: 2025 },
    );
    const contract = result.domestic.byCategory.find(
      (c) => c.category === "contract_research",
    );
    expect(contract?.rawAmount).toBe("1000.00");
    expect(contract?.qualifiedAmount).toBe("650.00");
    expect(result.domestic.totalQualifiedExpenses).toBe("650.00");
  });

  test("sums multiple categories into the domestic total", () => {
    const result = summarizeRdExpenses(
      [
        row({ category: "wages", amount: "1000.00" }),
        row({ category: "supplies", amount: "500.00" }),
        row({ category: "contract_research", amount: "1000.00" }),
      ],
      { bookId: "book-1", year: 2025 },
    );
    // 1000 + 500 + 650 = 2150
    expect(result.domestic.totalQualifiedExpenses).toBe("2150.00");
  });

  test("keeps foreign research separate from domestic", () => {
    const result = summarizeRdExpenses(
      [
        row({ category: "wages", amount: "1000.00", isForeign: false }),
        row({ category: "wages", amount: "400.00", isForeign: true }),
      ],
      { bookId: "book-1", year: 2025 },
    );
    expect(result.domestic.totalQualifiedExpenses).toBe("1000.00");
    expect(result.foreign.totalQualifiedExpenses).toBe("400.00");
  });

  test("totals raw expenses across domestic and foreign", () => {
    const result = summarizeRdExpenses(
      [
        row({
          category: "contract_research",
          amount: "1000.00",
          isForeign: false,
        }),
        row({ category: "wages", amount: "300.00", isForeign: true }),
      ],
      { bookId: "book-1", year: 2025 },
    );
    // raw is pre-haircut: 1000 + 300
    expect(result.totalRawExpenses).toBe("1300.00");
  });

  test("returns zeroed totals for no expenses", () => {
    const result = summarizeRdExpenses([], { bookId: "book-1", year: 2025 });
    expect(result.domestic.totalQualifiedExpenses).toBe("0.00");
    expect(result.foreign.totalQualifiedExpenses).toBe("0.00");
    expect(result.totalRawExpenses).toBe("0.00");
    expect(result.domestic.byCategory).toEqual([]);
  });

  test("echoes the book and year", () => {
    const result = summarizeRdExpenses([], { bookId: "book-9", year: 2024 });
    expect(result.bookId).toBe("book-9");
    expect(result.year).toBe(2024);
  });
});
