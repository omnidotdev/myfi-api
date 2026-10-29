import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceLineTable,
  invoiceTable,
  timeEntryTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let billTimeEntries: typeof import("./billTimeEntries").billTimeEntries;
let harness: TestDb;

describe("billTimeEntries", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ billTimeEntries } = await import("./billTimeEntries"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seed = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Time Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const [sales] = await harness.db
      .insert(accountTable)
      .values({ bookId, name: "Consulting", type: "revenue", subType: "sales" })
      .returning();
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Client" })
      .returning();
    return { bookId, salesId: sales!.id, customerId: customer!.id };
  };

  const addEntry = (
    bookId: string,
    customerId: string,
    hours: string,
    rate: string,
    overrides: Record<string, unknown> = {},
  ) =>
    harness.db
      .insert(timeEntryTable)
      .values({
        bookId,
        customerId,
        date: "2026-03-01",
        hours,
        rate,
        description: "Work",
        ...overrides,
      })
      .returning()
      .then((r) => r[0]!);

  test("bills entries onto a draft invoice and stamps them", async () => {
    const { bookId, salesId, customerId } = await seed("org_tt_bill");
    const e1 = await addEntry(bookId, customerId, "2", "150");
    const e2 = await addEntry(bookId, customerId, "3", "150");

    const result = await billTimeEntries({
      bookId,
      customerId,
      entryIds: [e1.id, e2.id],
      number: "T1001",
      issueDate: "2026-03-05",
      dueDate: "2026-04-05",
      incomeAccountId: salesId,
    });

    expect(result.lineCount).toBe(2);
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, result.invoiceId));
    expect(invoice?.status).toBe("draft");

    const lines = await harness.db
      .select()
      .from(invoiceLineTable)
      .where(eq(invoiceLineTable.invoiceId, result.invoiceId));
    expect(lines).toHaveLength(2);
    // 2h @ 150 = 300, 3h @ 150 = 450
    const amounts = lines
      .map((l) => Number(l.quantity) * Number(l.unitPrice))
      .sort((a, b) => a - b);
    expect(amounts).toEqual([300, 450]);

    const entries = await harness.db
      .select()
      .from(timeEntryTable)
      .where(eq(timeEntryTable.invoiceId, result.invoiceId));
    expect(entries).toHaveLength(2);
  });

  test("rejects an already-billed entry", async () => {
    const { bookId, salesId, customerId } = await seed("org_tt_dup");
    const e = await addEntry(bookId, customerId, "1", "100");
    await billTimeEntries({
      bookId,
      customerId,
      entryIds: [e.id],
      number: "T1002",
      issueDate: "2026-03-05",
      dueDate: "2026-04-05",
      incomeAccountId: salesId,
    });
    await expect(
      billTimeEntries({
        bookId,
        customerId,
        entryIds: [e.id],
        number: "T1003",
        issueDate: "2026-03-05",
        dueDate: "2026-04-05",
        incomeAccountId: salesId,
      }),
    ).rejects.toThrow(/not available to bill/i);
  });

  test("rejects a non-billable entry", async () => {
    const { bookId, salesId, customerId } = await seed("org_tt_nb");
    const e = await addEntry(bookId, customerId, "1", "100", {
      billable: false,
    });
    await expect(
      billTimeEntries({
        bookId,
        customerId,
        entryIds: [e.id],
        number: "T1004",
        issueDate: "2026-03-05",
        dueDate: "2026-04-05",
        incomeAccountId: salesId,
      }),
    ).rejects.toThrow(/not available to bill/i);
  });
});
