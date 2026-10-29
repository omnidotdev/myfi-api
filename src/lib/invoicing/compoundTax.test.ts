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

// Compound tax stacks a second tax on the amount PLUS the first tax, each
// posting to its own jurisdiction's payable account. Exercise it against real
// Postgres
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let harness: TestDb;

const acct = (
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

describe("compound tax", () => {
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

  test("a compound secondary tax is charged on the amount plus the primary tax", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_ct", name: "CT Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const gstPayable = await acct(bookId, "GST Payable", "liability", "other_liability");
    const pstPayable = await acct(bookId, "PST Payable", "liability", "other_liability");
    const [gst] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "GST",
        rate: "0.050000",
        filingFrequency: "quarterly",
        taxPayableAccountId: gstPayable.id,
      })
      .returning();
    const [pst] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "PST",
        rate: "0.070000",
        compound: true,
        filingFrequency: "quarterly",
        taxPayableAccountId: pstPayable.id,
      })
      .returning();
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-CT",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Service",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: income.id,
          taxJurisdictionId: gst!.id,
          secondaryTaxJurisdictionId: pst!.id,
        },
      ],
    });
    const posted = await postInvoice(draft.invoiceId, bookId);

    // GST 5% of 100 = 5; PST 7% of (100 + 5) = 7.35; total tax 12.35
    expect(posted.total).toBe(112.35);
    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, posted.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(income.id)?.credit).toBe("100.0000");
    expect(byAccount(gstPayable.id)?.credit).toBe("5.0000");
    expect(byAccount(pstPayable.id)?.credit).toBe("7.3500");
    expect(byAccount(ar.id)?.debit).toBe("112.3500");
  });
});
