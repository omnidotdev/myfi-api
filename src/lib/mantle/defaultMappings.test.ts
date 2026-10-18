import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockInsertValues,
  resetDbMock,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { seedDefaultMantleMappings } = await import("./defaultMappings");

const BOOK = "book-1";

// Accounts in createdAt order, one per relevant subType
const accounts = [
  { id: "ar", subType: "accounts_receivable" },
  { id: "cash", subType: "cash" },
  { id: "sales", subType: "sales" },
  { id: "cc", subType: "customer_credit" },
];

describe("seedDefaultMantleMappings", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("creates default mappings with correct debit/credit when accounts resolve", async () => {
    setSelectResults([accounts, []]); // accounts, then existing mappings (none)

    const created = await seedDefaultMantleMappings(BOOK);
    const byEvent = Object.fromEntries(created.map((m) => [m.eventType, m]));

    expect(Object.keys(byEvent).sort()).toEqual([
      "credit.applied",
      "credit.issued",
      "invoice.sent",
      "payment.received",
      "payment.reversed",
    ]);
    expect(byEvent["invoice.sent"]).toMatchObject({
      bookId: BOOK,
      debitAccountId: "ar",
      creditAccountId: "sales",
    });
    expect(byEvent["payment.received"]).toMatchObject({
      debitAccountId: "cash",
      creditAccountId: "ar",
    });
    expect(byEvent["payment.reversed"]).toMatchObject({
      debitAccountId: "ar",
      creditAccountId: "cash",
    });
    expect(byEvent["credit.issued"]).toMatchObject({
      debitAccountId: "ar",
      creditAccountId: "cc",
    });
    expect(byEvent["credit.applied"]).toMatchObject({
      debitAccountId: "cc",
      creditAccountId: "ar",
    });
  });

  test("skips event types that already have a mapping", async () => {
    setSelectResults([accounts, [{ eventType: "invoice.sent" }]]);

    const created = await seedDefaultMantleMappings(BOOK);

    expect(created.map((m) => m.eventType)).not.toContain("invoice.sent");
    expect(created).toHaveLength(4);
  });

  test("creates nothing and writes nothing when required accounts are missing", async () => {
    setSelectResults([[], []]); // no accounts

    const created = await seedDefaultMantleMappings(BOOK);

    expect(created).toHaveLength(0);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
