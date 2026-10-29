import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  estimateLineTable,
  estimateTable,
  invoiceLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let createProgressInvoice: typeof import("./createProgressInvoice").createProgressInvoice;
let harness: TestDb;

describe("createProgressInvoice", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ createProgressInvoice } = await import("./createProgressInvoice"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("bills a percentage per invoice and caps at the line total", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_pi", name: "PI Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const [income] = await db
      .insert(accountTable)
      .values({ bookId, name: "Sales", type: "revenue", subType: "sales" })
      .returning();
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    const [estimate] = await db
      .insert(estimateTable)
      .values({
        bookId,
        customerId: customer!.id,
        number: "EST-1",
        status: "accepted",
        estimateDate: "2026-02-01",
        subtotal: "1000.0000",
        total: "1000.0000",
      })
      .returning();
    await db.insert(estimateLineTable).values({
      estimateId: estimate!.id,
      description: "Phase work",
      quantity: "1",
      unitPrice: "1000.0000",
      amount: "1000.0000",
      incomeAccountId: income!.id,
    });

    // Bill 40% -> a 400 draft invoice; estimate partially invoiced
    const first = await createProgressInvoice({
      estimateId: estimate!.id,
      bookId,
      invoiceNumber: "INV-P1",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      percent: 40,
    });
    expect(first.fullyBilled).toBe(false);
    const firstLines = await db
      .select({ amount: invoiceLineTable.amount })
      .from(invoiceLineTable)
      .where(eq(invoiceLineTable.invoiceId, first.invoiceId));
    expect(firstLines[0]?.amount).toBe("400.0000");

    // Bill 100% more -> capped at the remaining 600; estimate fully invoiced
    const second = await createProgressInvoice({
      estimateId: estimate!.id,
      bookId,
      invoiceNumber: "INV-P2",
      issueDate: "2026-04-01",
      dueDate: "2026-05-01",
      percent: 100,
    });
    expect(second.fullyBilled).toBe(true);
    const secondLines = await db
      .select({ amount: invoiceLineTable.amount })
      .from(invoiceLineTable)
      .where(eq(invoiceLineTable.invoiceId, second.invoiceId));
    expect(secondLines[0]?.amount).toBe("600.0000");

    // Nothing left to bill
    await expect(
      Promise.resolve(
        createProgressInvoice({
          estimateId: estimate!.id,
          bookId,
          invoiceNumber: "INV-P3",
          issueDate: "2026-05-01",
          dueDate: "2026-06-01",
          percent: 10,
        }),
      ),
    ).rejects.toThrow(/already fully invoiced/);
  });
});
