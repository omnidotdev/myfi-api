import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// A foreign-currency invoice stores its amounts in its own currency but posts to
// the ledger in the book's home currency, converted at the invoice's rate; the
// rate difference at payment is a realized FX gain or loss. Exercise it all
// against real Postgres
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let recordInvoicePayment: typeof import("./recordInvoicePayment").recordInvoicePayment;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "liability" | "revenue" | "expense",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

const linesFor = (journalEntryId: string) =>
  harness.db
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, journalEntryId));

describe("multi-currency invoices", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
    ({ postInvoice } = await import("./postInvoice"));
    ({ recordInvoicePayment } = await import("./recordInvoicePayment"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("a foreign invoice posts to the ledger in home currency at its rate", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_mc", name: "MC Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Euro Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-EUR",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      currency: "EUR",
      exchangeRate: 1.1,
      lines: [
        { description: "Service", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    const posted = await postInvoice(draft.invoiceId, bookId);

    // Invoice total is stored in EUR
    const [inv] = await db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(inv?.currency).toBe("EUR");
    expect(inv?.total).toBe("100.0000");

    // Ledger is in USD home currency: 100 EUR x 1.1 = 110 USD
    const lines = await linesFor(posted.journalEntryId);
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(ar.id)?.debit).toBe("110.0000");
    expect(byAccount(income.id)?.credit).toBe("110.0000");
  });

  test("a payment at a different rate books a realized FX gain/loss", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_mc2", name: "MC Co 2", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Euro Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-EUR2",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      currency: "EUR",
      exchangeRate: 1.1,
      lines: [
        { description: "Service", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    await postInvoice(draft.invoiceId, bookId);

    // Paid 100 EUR when the rate has fallen to 1.05: receive 105 USD, relieve
    // AR of the 110 USD booked, so a 5 USD realized loss
    const payment = await recordInvoicePayment({
      invoiceId: draft.invoiceId,
      bookId,
      amount: 100,
      depositAccountId: bank.id,
      date: "2026-04-01",
      exchangeRate: 1.05,
    });
    expect(payment.invoiceStatus).toBe("paid");

    const lines = await linesFor(payment.journalEntryId);
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(bank.id)?.debit).toBe("105.0000");
    expect(byAccount(ar.id)?.credit).toBe("110.0000");

    const [fx] = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.subType, "fx_gain_loss"));
    expect(fx).toBeDefined();
    expect(byAccount(fx!.id)?.debit).toBe("5.0000");
  });

  test("a home-currency invoice and payment are unchanged (no FX line)", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_mc3", name: "MC Co 3", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Local Buyer" })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-USD",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        { description: "Service", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    const posted = await postInvoice(draft.invoiceId, bookId);
    const payment = await recordInvoicePayment({
      invoiceId: draft.invoiceId,
      bookId,
      amount: 100,
      depositAccountId: bank.id,
      date: "2026-04-01",
    });

    // Home-currency payment posts exactly two lines: deposit and AR, no FX
    const lines = await linesFor(payment.journalEntryId);
    expect(lines).toHaveLength(2);
    expect(posted.total).toBe(100);
  });
});
