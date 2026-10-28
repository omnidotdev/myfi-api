import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Line discounts change the money math, so exercise draft creation and posting
// against real Postgres: a discount reduces the net that credits income and the
// tax base, not just a displayed figure
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let harness: TestDb;

const seedAccount = (
  bookId: string,
  name: string,
  type: "asset" | "liability" | "revenue",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("invoice line discounts", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
    ({ postInvoice } = await import("./postInvoice"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const linesForEntry = (journalEntryId: string) =>
    harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, journalEntryId));

  test("applies the discount to the net amount and taxes the discounted amount", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_disc", name: "Disc Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const income = await seedAccount(bookId, "Sales", "revenue", "sales");
    const payable = await seedAccount(
      bookId,
      "Tax Payable",
      "liability",
      "other_liability",
    );
    const [jur] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "State",
        rate: "0.100000",
        filingFrequency: "annually",
        taxPayableAccountId: payable.id,
      })
      .returning();
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-DISC",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Widget",
          quantity: 1,
          unitPrice: 100,
          discountPercent: 0.1,
          incomeAccountId: income.id,
          taxJurisdictionId: jur!.id,
        },
      ],
    });
    // 100 less 10% = 90 net subtotal before tax
    expect(draft.subtotal).toBe(90);

    const posted = await postInvoice(draft.invoiceId, bookId);
    // Net 90 plus 10% tax on the discounted amount = 99
    expect(posted.total).toBe(99);

    const lines = await linesForEntry(posted.journalEntryId);
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(ar.id)?.debit).toBe("99.0000");
    expect(byAccount(income.id)?.credit).toBe("90.0000");
    expect(byAccount(payable.id)?.credit).toBe("9.0000");
  });

  test("a line with no discount is unchanged", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_nodisc", name: "No Disc", type: "llc" })
      .returning();
    const bookId = book!.id;
    await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const income = await seedAccount(bookId, "Sales", "revenue", "sales");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-FULL",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Widget",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: income.id,
        },
      ],
    });
    expect(draft.subtotal).toBe(100);
  });
});
