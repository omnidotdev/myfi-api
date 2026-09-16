import { describe, expect, test } from "bun:test";

import { advanceDate } from "./advanceDate";

describe("advanceDate", () => {
  test("weekly adds 7 days", () => {
    expect(advanceDate("2026-03-01", "weekly")).toBe("2026-03-08");
  });

  test("biweekly adds 14 days", () => {
    expect(advanceDate("2026-03-01", "biweekly")).toBe("2026-03-15");
  });

  test("monthly adds one month", () => {
    expect(advanceDate("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  test("monthly clamps to end of a shorter month", () => {
    // Jan 31 + 1 month -> Feb 28 (2026 is not a leap year)
    expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  test("quarterly adds three months", () => {
    expect(advanceDate("2026-01-15", "quarterly")).toBe("2026-04-15");
  });

  test("yearly adds twelve months", () => {
    expect(advanceDate("2026-02-28", "yearly")).toBe("2027-02-28");
  });

  test("monthly rolls over the year boundary", () => {
    expect(advanceDate("2026-12-10", "monthly")).toBe("2027-01-10");
  });
});
