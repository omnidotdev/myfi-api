import { describe, expect, test } from "bun:test";

import { buildBooksReadyEmail } from "./closeNotifications";

describe("buildBooksReadyEmail", () => {
  test("names the book and period in the subject", () => {
    const { subject } = buildBooksReadyEmail({
      bookName: "Omni LLC",
      year: 2025,
      month: 8,
    });
    expect(subject).toContain("Omni LLC");
    expect(subject).toContain("August 2025");
    expect(subject.toLowerCase()).toContain("ready");
  });

  test("tells the reader the period closed cleanly", () => {
    const { body } = buildBooksReadyEmail({
      bookName: "Omni LLC",
      year: 2025,
      month: 8,
    });
    expect(body).toContain("August 2025");
    expect(body).toContain("Omni LLC");
    expect(body.toLowerCase()).toContain("closed");
  });

  test("formats the month name from the 1-based month number", () => {
    const { subject } = buildBooksReadyEmail({
      bookName: "Book",
      year: 2024,
      month: 1,
    });
    expect(subject).toContain("January 2024");
  });
});
