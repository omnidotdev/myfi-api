import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { asc, eq } from "drizzle-orm";

import {
  accountTable,
  billLineTable,
  billTable,
  bookTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Draft creation stores the pre-tax subtotal and the per-line net amount, so
// exercise it against real Postgres: the bill and line rows it writes are what
// posting later reads, and the FK and NOT NULL constraints are enforced
let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let harness: TestDb;

const seedAccount = (
  bookId: string,
  name: string,
  type: NonNullable<InsertAccount["type"]>,
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("createBillDraft", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBillDraft } = await import("./createBillDraft"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Bill Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const rent = await seedAccount(
      bookId,
      "Rent",
      "expense",
      "operating_expense",
    );
    const supplies = await seedAccount(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const [vendor] = await harness.db
      .insert(vendorTable)
      .values({ bookId, name: "Supplier" })
      .returning();
    return { bookId, vendorId: vendor!.id, rent, supplies };
  };

  test("creates a draft bill with computed line amounts and subtotal", async () => {
    const { bookId, vendorId, rent, supplies } = await seedBook("org_bdraft");

    const result = await createBillDraft({
      bookId,
      vendorId,
      number: "B-1",
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Rent",
          quantity: 1,
          unitPrice: 1200,
          expenseAccountId: rent.id,
        },
        {
          description: "Supplies",
          quantity: 3,
          unitPrice: 10,
          expenseAccountId: supplies.id,
        },
      ],
    });

    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, result.billId));
    expect(bill).toMatchObject({
      vendorId,
      status: "draft",
      subtotal: "1230.0000",
      total: "1230.0000",
    });

    const lines = await harness.db
      .select()
      .from(billLineTable)
      .where(eq(billLineTable.billId, result.billId))
      .orderBy(asc(billLineTable.sortOrder));
    expect(lines).toHaveLength(2);

    expect(result).toEqual({
      billId: result.billId,
      number: "B-1",
      subtotal: 1230,
      lineCount: 2,
    });
  });

  test("throws when there are no lines", async () => {
    const { bookId, vendorId } = await seedBook("org_bdraft_empty");
    await expect(
      createBillDraft({
        bookId,
        vendorId,
        number: "B-2",
        billDate: "2026-09-01",
        dueDate: "2026-10-01",
        lines: [],
      }),
    ).rejects.toThrow(/at least one line/);
    const bills = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.bookId, bookId));
    expect(bills).toHaveLength(0);
  });
});
