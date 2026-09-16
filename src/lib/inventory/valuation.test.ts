import { describe, expect, test } from "bun:test";

import { hasSufficientStock, movementValue, newAverageCost } from "./valuation";

describe("newAverageCost", () => {
  test("blends existing and received cost by quantity", () => {
    // 10 @ $2 + 10 @ $4 = 20 @ $3
    expect(newAverageCost(10, 2, 10, 4)).toBe(3);
  });

  test("first receipt sets the average to the received cost", () => {
    expect(newAverageCost(0, 0, 5, 7.5)).toBe(7.5);
  });

  test("rounds to four decimals", () => {
    // (1*10 + 2*3.3333) / 3 = 5.5555...
    expect(newAverageCost(1, 10, 2, 3.3333)).toBe(5.5555);
  });

  test("leaves the average unchanged when quantity nets to zero", () => {
    expect(newAverageCost(5, 4, -5, 0)).toBe(4);
  });
});

describe("movementValue", () => {
  test("multiplies quantity by unit cost at 4 decimals", () => {
    expect(movementValue(3, 2.5)).toBe(7.5);
  });
});

describe("hasSufficientStock", () => {
  test("allows a sale up to the quantity on hand", () => {
    expect(hasSufficientStock(10, 10)).toBe(true);
    expect(hasSufficientStock(10, 4)).toBe(true);
  });
  test("rejects overselling", () => {
    expect(hasSufficientStock(10, 11)).toBe(false);
  });
});
