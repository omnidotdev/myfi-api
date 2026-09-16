import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setSelectResults,
  setUpdateReturningData,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { getBookInvoiceSource, isMantleManaged, adoptMantleSource } =
  await import("./invoiceSource");

beforeEach(() => {
  resetDbMock();
});

describe("getBookInvoiceSource", () => {
  test("returns mantle when the book is Mantle-managed", async () => {
    setSelectResults([[{ invoiceSource: "mantle" }]]);
    expect(await getBookInvoiceSource("book-1")).toBe("mantle");
  });

  test("defaults to myfi for a native or unknown book", async () => {
    setSelectResults([[{ invoiceSource: "myfi" }]]);
    expect(await getBookInvoiceSource("book-1")).toBe("myfi");
    setSelectResults([[]]);
    expect(await getBookInvoiceSource("missing")).toBe("myfi");
  });
});

describe("isMantleManaged", () => {
  test("is true only for a mantle book", async () => {
    setSelectResults([[{ invoiceSource: "mantle" }]]);
    expect(await isMantleManaged("book-1")).toBe(true);
    setSelectResults([[{ invoiceSource: "myfi" }]]);
    expect(await isMantleManaged("book-1")).toBe(false);
  });
});

describe("adoptMantleSource", () => {
  test("flips a myfi book to mantle and reports the change", async () => {
    setUpdateReturningData([{ id: "book-1" }]);
    expect(await adoptMantleSource("book-1")).toBe(true);
  });

  test("is a no-op (false) when already mantle-managed", async () => {
    setUpdateReturningData([]);
    expect(await adoptMantleSource("book-1")).toBe(false);
  });
});
