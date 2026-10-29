import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  accountingPeriodTable,
  bookTable,
  customerTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Voiding posts a dated reversing entry rather than deleting the original, so
// exercise it against real Postgres: the swapped debit/credit lines, the
// closed-period refusal, and the payment guard are all money-critical
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let recordInvoicePayment: typeof import("./recordInvoicePayment").recordInvoicePayment;
let voidInvoice: typeof import("./voidInvoice").voidInvoice;
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

describe("voidInvoice", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
    ({ postInvoice } = await import("./postInvoice"));
    ({ recordInvoicePayment } = await import("./recordInvoicePayment"));
    ({ voidInvoice } = await import("./voidInvoice"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Void Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const cash = await seedAccount(bookId, "Cash", "asset", "cash");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    return { bookId, ar, sales, cash, customerId: customer!.id };
  };

  const draftFor = (
    bookId: string,
    customerId: string,
    salesId: string,
    number: string,
    issueDate = "2026-09-01",
  ) =>
    createInvoiceDraft({
      bookId,
      customerId,
      number,
      issueDate,
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Work",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: salesId,
        },
      ],
    });

  test("posts a reversing entry (not a delete) and marks a posted invoice void", async () => {
    const { bookId, ar, sales, customerId } = await seedBook("org_void");
    const draft = await draftFor(bookId, customerId, sales.id, "1001");
    await postInvoice(draft.invoiceId, bookId);

    const result = await voidInvoice(draft.invoiceId, bookId);

    const [reversal] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.source, "invoice_void"));
    expect(reversal).toMatchObject({ sourceReferenceId: draft.invoiceId });

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, reversal!.id));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // Each side swapped: the original AR debit becomes a credit, the sales
    // credit becomes a debit
    expect(byAccount(ar.id)).toMatchObject({
      debit: "0.0000",
      credit: "100.0000",
    });
    expect(byAccount(sales.id)).toMatchObject({
      debit: "100.0000",
      credit: "0.0000",
    });

    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("void");
    expect(result).toEqual({ invoiceId: draft.invoiceId, alreadyVoid: false });
  });

  test("refuses to reverse into a closed period", async () => {
    const { bookId, sales, customerId } = await seedBook("org_void_closed");
    // The reversal posts in today's period; close that period so the void is
    // refused. Post the invoice in an earlier, open period so posting succeeds
    const today = new Date();
    await harness.db.insert(accountingPeriodTable).values({
      bookId,
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
      status: "closed",
    });
    const past = new Date(today.getTime() - 70 * 24 * 60 * 60 * 1000);
    const issueDate = `${past.getUTCFullYear()}-${String(
      past.getUTCMonth() + 1,
    ).padStart(2, "0")}-01`;
    const draft = await draftFor(
      bookId,
      customerId,
      sales.id,
      "1002",
      issueDate,
    );
    await postInvoice(draft.invoiceId, bookId);

    await expect(voidInvoice(draft.invoiceId, bookId)).rejects.toThrow(
      /closed period/,
    );
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("open");
  });

  test("voids a draft invoice with no ledger change", async () => {
    const { bookId, sales, customerId } = await seedBook("org_void_draft");
    const draft = await draftFor(bookId, customerId, sales.id, "1003");

    const result = await voidInvoice(draft.invoiceId, bookId);

    expect(result).toEqual({ invoiceId: draft.invoiceId, alreadyVoid: false });
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("void");
    // A never-posted invoice produces no reversing journal entry
    const reversals = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.sourceReferenceId, draft.invoiceId));
    expect(reversals).toHaveLength(0);
  });

  test("refuses to void an invoice with payments", async () => {
    const { bookId, sales, cash, customerId } = await seedBook("org_void_paid");
    const draft = await draftFor(bookId, customerId, sales.id, "1004");
    await postInvoice(draft.invoiceId, bookId);
    await recordInvoicePayment({
      invoiceId: draft.invoiceId,
      bookId,
      depositAccountId: cash.id,
      date: "2026-09-10",
      amount: 40,
    });

    await expect(voidInvoice(draft.invoiceId, bookId)).rejects.toThrow(
      /payments/,
    );
  });

  test("is a no-op on an already-void invoice", async () => {
    const { bookId, sales, customerId } = await seedBook("org_void_again");
    const draft = await draftFor(bookId, customerId, sales.id, "1005");
    await postInvoice(draft.invoiceId, bookId);
    await voidInvoice(draft.invoiceId, bookId);

    const result = await voidInvoice(draft.invoiceId, bookId);
    expect(result).toEqual({ invoiceId: draft.invoiceId, alreadyVoid: true });
  });

  test("rejects a cross-book invoice (IDOR)", async () => {
    const { bookId, sales, customerId } = await seedBook("org_void_idor");
    const [other] = await harness.db
      .insert(bookTable)
      .values({
        organizationId: "org_void_idor_other",
        name: "Other",
        type: "llc",
      })
      .returning();
    const draft = await draftFor(bookId, customerId, sales.id, "1006");
    await postInvoice(draft.invoiceId, bookId);
    await expect(voidInvoice(draft.invoiceId, other!.id)).rejects.toThrow(
      /not found/,
    );
  });
});
