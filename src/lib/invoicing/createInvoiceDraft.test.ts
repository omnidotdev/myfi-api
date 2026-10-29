import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { asc, eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceLineTable,
  invoiceTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Draft creation stores the pre-tax subtotal and the per-line net amount, so
// exercise it against real Postgres: the invoice and line rows it writes are
// what posting later reads, and the FK and NOT NULL constraints are enforced
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
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

describe("createInvoiceDraft", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Draft Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const service = await seedAccount(
      bookId,
      "Service",
      "revenue",
      "service_revenue",
    );
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    return { bookId, customerId: customer!.id, sales, service };
  };

  test("creates a draft invoice with computed line amounts and subtotal", async () => {
    const { bookId, customerId, sales, service } = await seedBook("org_draft");

    const result = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1001",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Design",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: sales.id,
        },
        {
          description: "Hosting",
          quantity: 1,
          unitPrice: 30,
          incomeAccountId: service.id,
        },
      ],
    });

    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, result.invoiceId));
    expect(invoice).toMatchObject({
      bookId,
      customerId,
      number: "1001",
      status: "draft",
      subtotal: "130.0000",
      taxAmount: "0.0000",
      total: "130.0000",
    });

    const lines = await harness.db
      .select()
      .from(invoiceLineTable)
      .where(eq(invoiceLineTable.invoiceId, result.invoiceId))
      .orderBy(asc(invoiceLineTable.sortOrder));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      description: "Design",
      amount: "100.0000",
      sortOrder: 0,
    });

    expect(result).toEqual({
      invoiceId: result.invoiceId,
      number: "1001",
      subtotal: 130,
      lineCount: 2,
    });
  });

  test("throws when there are no lines", async () => {
    const { bookId, customerId } = await seedBook("org_draft_empty");
    await expect(
      createInvoiceDraft({
        bookId,
        customerId,
        number: "1002",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        lines: [],
      }),
    ).rejects.toThrow(/at least one line/);
    // No invoice row is written when the input is rejected before the transaction
    const invoices = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.bookId, bookId));
    expect(invoices).toHaveLength(0);
  });
});
