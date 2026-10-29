import { describe, expect, test } from "bun:test";

import { applyPriceLevel } from "./applyPriceLevel";

describe("applyPriceLevel", () => {
  test("applies a discount percentage", () => {
    expect(applyPriceLevel(100, -10)).toBe(90);
  });

  test("applies a markup percentage", () => {
    expect(applyPriceLevel(100, 15)).toBe(115);
  });

  test("leaves the price unchanged at zero percent", () => {
    expect(applyPriceLevel(49.99, 0)).toBe(49.99);
  });

  test("rounds to the money scale", () => {
    // 33.33 * 0.9 = 29.997 -> 29.997 at ten-thousandths
    expect(applyPriceLevel(33.33, -10)).toBe(29.997);
  });

  test("never returns a negative price", () => {
    expect(applyPriceLevel(50, -250)).toBe(0);
  });
});
