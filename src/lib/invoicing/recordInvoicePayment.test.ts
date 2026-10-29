import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { asc, eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoicePaymentTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Recording a payment credits AR and debits the deposit account, then advances
// the invoice balance, so exercise it against real Postgres: the receipt
// posting and the overpayment guard are money-critical
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let recordInvoicePayment: typeof import("./recordInvoicePayment").recordInvoicePayment;
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

describe("recordInvoicePayment", () => {
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

  // Seed a book with a posted, unpaid invoice of the given total (one untaxed
  // line) plus a cash deposit account, returning the identifiers a payment needs
  const seedPostedInvoice = async (
    organizationId: string,
    total: number,
    number: string,
  ) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Pay Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const cash = await seedAccount(bookId, "Cash", "asset", "cash");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number,
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Work",
          quantity: 1,
          unitPrice: total,
          incomeAccountId: sales.id,
        },
      ],
    });
    await postInvoice(draft.invoiceId, bookId);
    return { bookId, invoiceId: draft.invoiceId, ar, cash };
  };

  test("posts DR deposit / CR AR and marks the invoice partial", async () => {
    const { bookId, invoiceId, ar, cash } = await seedPostedInvoice(
      "org_pay_partial",
      100,
      "1001",
    );

    const result = await recordInvoicePayment({
      invoiceId,
      bookId,
      depositAccountId: cash.id,
      date: "2026-09-10",
      amount: 40,
    });

    const [payment] = await harness.db
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.id, result.paymentId));
    expect(payment).toMatchObject({
      bookId,
      invoiceId,
      amount: "40.0000",
      depositAccountId: cash.id,
      journalEntryId: result.journalEntryId,
    });

    const [entry] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.id, result.journalEntryId));
    expect(entry).toMatchObject({
      source: "invoice_payment",
      sourceReferenceId: result.paymentId,
    });

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId))
      .orderBy(asc(journalLineTable.debit));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(cash.id)).toMatchObject({
      debit: "40.0000",
      credit: "0.0000",
    });
    expect(byAccount(ar.id)).toMatchObject({
      debit: "0.0000",
      credit: "40.0000",
    });

    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoiceId));
    expect(invoice).toMatchObject({ amountPaid: "40.0000", status: "partial" });
    expect(result).toMatchObject({ invoiceStatus: "partial", amountPaid: 40 });
  });

  test("marks the invoice paid when the balance is cleared", async () => {
    const { bookId, invoiceId, cash } = await seedPostedInvoice(
      "org_pay_paid",
      100,
      "1002",
    );
    await recordInvoicePayment({
      invoiceId,
      bookId,
      depositAccountId: cash.id,
      date: "2026-09-10",
      amount: 60,
    });
    const result = await recordInvoicePayment({
      invoiceId,
      bookId,
      depositAccountId: cash.id,
      date: "2026-09-11",
      amount: 40,
    });

    expect(result.invoiceStatus).toBe("paid");
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoiceId));
    expect(invoice).toMatchObject({ amountPaid: "100.0000", status: "paid" });
  });

  test("rejects overpayment", async () => {
    const { bookId, invoiceId, cash } = await seedPostedInvoice(
      "org_pay_over",
      100,
      "1003",
    );
    await expect(
      recordInvoicePayment({
        invoiceId,
        bookId,
        depositAccountId: cash.id,
        date: "2026-09-10",
        amount: 150,
      }),
    ).rejects.toThrow(/exceeds the balance/);
    const payments = await harness.db
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.invoiceId, invoiceId));
    expect(payments).toHaveLength(0);
  });

  test("rejects a payment exceeding the balance left by a prior committed payment", async () => {
    // The mock suite simulated a stale outer read racing a concurrent payment so
    // the FOR UPDATE re-read catches the overpayment. A single in-process PGlite
    // connection cannot run two transactions concurrently, so this asserts the
    // same invariant sequentially: after a committed partial payment the balance
    // guard refuses a payment over the remaining balance and writes nothing, so
    // AR is never double-credited
    const { bookId, invoiceId, cash } = await seedPostedInvoice(
      "org_pay_race",
      100,
      "1004",
    );
    await recordInvoicePayment({
      invoiceId,
      bookId,
      depositAccountId: cash.id,
      date: "2026-09-10",
      amount: 70,
    });
    await expect(
      recordInvoicePayment({
        invoiceId,
        bookId,
        depositAccountId: cash.id,
        date: "2026-09-11",
        amount: 50,
      }),
    ).rejects.toThrow(/exceeds the balance/);

    const payments = await harness.db
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.invoiceId, invoiceId));
    expect(payments).toHaveLength(1);
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invoiceId));
    expect(invoice).toMatchObject({ amountPaid: "70.0000", status: "partial" });
  });

  test("rejects a non-positive amount", async () => {
    const { bookId, invoiceId, cash } = await seedPostedInvoice(
      "org_pay_zero",
      100,
      "1005",
    );
    await expect(
      recordInvoicePayment({
        invoiceId,
        bookId,
        depositAccountId: cash.id,
        date: "2026-09-10",
        amount: 0,
      }),
    ).rejects.toThrow(/must be positive/);
  });

  test("rejects a payment on a draft invoice", async () => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId: "org_pay_draft", name: "Pay Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const cash = await seedAccount(bookId, "Cash", "asset", "cash");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "1006",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Work",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: sales.id,
        },
      ],
    });
    await expect(
      recordInvoicePayment({
        invoiceId: draft.invoiceId,
        bookId,
        depositAccountId: cash.id,
        date: "2026-09-10",
        amount: 10,
      }),
    ).rejects.toThrow(/posted, unpaid/);
  });

  test("rejects a cross-book invoice (IDOR)", async () => {
    const { invoiceId, cash } = await seedPostedInvoice(
      "org_pay_idor",
      100,
      "1007",
    );
    const [other] = await harness.db
      .insert(bookTable)
      .values({
        organizationId: "org_pay_idor_other",
        name: "Other",
        type: "llc",
      })
      .returning();
    await expect(
      recordInvoicePayment({
        invoiceId,
        bookId: other!.id,
        depositAccountId: cash.id,
        date: "2026-09-10",
        amount: 10,
      }),
    ).rejects.toThrow(/not found/);
  });
});
