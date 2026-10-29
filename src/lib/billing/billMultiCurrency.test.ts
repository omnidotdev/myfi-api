import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// A foreign-currency bill stores its amounts in its own currency, posts to the
// ledger in home currency at the bill rate, and books a realized FX gain/loss
// when paid at a different rate. Exercise it against real Postgres
let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let postBill: typeof import("./postBill").postBill;
let recordBillPayment: typeof import("./recordBillPayment").recordBillPayment;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "liability" | "expense",
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

describe("multi-currency bills", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBillDraft } = await import("./createBillDraft"));
    ({ postBill } = await import("./postBill"));
    ({ recordBillPayment } = await import("./recordBillPayment"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("a foreign bill posts to home currency and pays with a realized FX gain", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_mcb", name: "MCB Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(bookId, "Supplies", "expense", "operating_expense");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Euro Vendor" })
      .returning();

    const draft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-EUR",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      currency: "EUR",
      exchangeRate: 1.1,
      lines: [
        { description: "Parts", quantity: 1, unitPrice: 100, expenseAccountId: expense.id },
      ],
    });
    const posted = await postBill(draft.billId, bookId);

    // 100 EUR x 1.1 = 110 USD posted
    const postLines = await linesFor(posted.journalEntryId);
    const byAccountPost = (id: string) => postLines.find((l) => l.accountId === id);
    expect(byAccountPost(expense.id)?.debit).toBe("110.0000");
    expect(byAccountPost(ap.id)?.credit).toBe("110.0000");

    // Pay 100 EUR when the rate has fallen to 1.05: 105 USD leaves, AP relieved
    // of 110 USD, so a 5 USD realized gain (paid less than booked)
    const payment = await recordBillPayment({
      billId: draft.billId,
      bookId,
      amount: 100,
      paymentAccountId: bank.id,
      date: "2026-04-01",
      exchangeRate: 1.05,
    });
    const payLines = await linesFor(payment.journalEntryId);
    const byAccountPay = (id: string) => payLines.find((l) => l.accountId === id);
    expect(byAccountPay(ap.id)?.debit).toBe("110.0000");
    expect(byAccountPay(bank.id)?.credit).toBe("105.0000");
    const [fx] = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.subType, "fx_gain_loss"));
    expect(byAccountPay(fx!.id)?.credit).toBe("5.0000");
  });

  test("a home-currency bill payment is unchanged (no FX line)", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_mcb2", name: "MCB Co 2", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(bookId, "Supplies", "expense", "operating_expense");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Local Vendor" })
      .returning();

    const draft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-USD",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        { description: "Parts", quantity: 1, unitPrice: 100, expenseAccountId: expense.id },
      ],
    });
    await postBill(draft.billId, bookId);
    const payment = await recordBillPayment({
      billId: draft.billId,
      bookId,
      amount: 100,
      paymentAccountId: bank.id,
      date: "2026-04-01",
    });
    const lines = await linesFor(payment.journalEntryId);
    expect(lines).toHaveLength(2);
  });
});
