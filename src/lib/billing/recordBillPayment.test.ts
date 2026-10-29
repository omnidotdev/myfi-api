import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { asc, eq } from "drizzle-orm";

import {
  accountTable,
  billPaymentTable,
  billTable,
  bookTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Recording a bill payment debits AP and credits the payment account, then
// advances the bill balance, so exercise it against real Postgres: the posting
// and the overpayment guard are money-critical
let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let postBill: typeof import("./postBill").postBill;
let recordBillPayment: typeof import("./recordBillPayment").recordBillPayment;
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

describe("recordBillPayment", () => {
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

  const seedPostedBill = async (
    organizationId: string,
    total: number,
    number: string,
  ) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Bill Pay Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = await seedAccount(bookId, "AP", "liability", "accounts_payable");
    const supplies = await seedAccount(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const cash = await seedAccount(bookId, "Cash", "asset", "cash");
    const [vendor] = await harness.db
      .insert(vendorTable)
      .values({ bookId, name: "Supplier" })
      .returning();
    const draft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number,
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: total,
          expenseAccountId: supplies.id,
        },
      ],
    });
    await postBill(draft.billId, bookId);
    return { bookId, billId: draft.billId, ap, cash };
  };

  test("posts DR AP / CR payment account and marks the bill paid", async () => {
    const { bookId, billId, ap, cash } = await seedPostedBill(
      "org_bp_paid",
      100,
      "B-1",
    );

    const result = await recordBillPayment({
      billId,
      bookId,
      paymentAccountId: cash.id,
      date: "2026-09-10",
      amount: 100,
    });

    const [payment] = await harness.db
      .select()
      .from(billPaymentTable)
      .where(eq(billPaymentTable.id, result.paymentId));
    expect(payment).toMatchObject({
      billId,
      amount: "100.0000",
      paymentAccountId: cash.id,
    });

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId))
      .orderBy(asc(journalLineTable.credit));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(ap.id)).toMatchObject({
      debit: "100.0000",
      credit: "0.0000",
    });
    expect(byAccount(cash.id)).toMatchObject({
      debit: "0.0000",
      credit: "100.0000",
    });

    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, billId));
    expect(bill).toMatchObject({ amountPaid: "100.0000", status: "paid" });
    expect(result).toMatchObject({ billStatus: "paid", amountPaid: 100 });
  });

  test("rejects overpayment", async () => {
    const { bookId, billId, cash } = await seedPostedBill(
      "org_bp_over",
      100,
      "B-2",
    );
    await expect(
      recordBillPayment({
        billId,
        bookId,
        paymentAccountId: cash.id,
        date: "2026-09-10",
        amount: 150,
      }),
    ).rejects.toThrow(/exceeds the balance/);
    const payments = await harness.db
      .select()
      .from(billPaymentTable)
      .where(eq(billPaymentTable.billId, billId));
    expect(payments).toHaveLength(0);
  });

  test("rejects a cross-book bill (IDOR)", async () => {
    const { billId, cash } = await seedPostedBill("org_bp_idor", 100, "B-3");
    const [other] = await harness.db
      .insert(bookTable)
      .values({
        organizationId: "org_bp_idor_other",
        name: "Other",
        type: "llc",
      })
      .returning();
    await expect(
      recordBillPayment({
        billId,
        bookId: other!.id,
        paymentAccountId: cash.id,
        date: "2026-09-10",
        amount: 10,
      }),
    ).rejects.toThrow(/not found/);
  });

  test("rejects a payment exceeding the balance left by a prior committed payment", async () => {
    // The mock suite simulated a stale outer read racing a concurrent payment so
    // the FOR UPDATE re-read catches the overpayment. A single in-process PGlite
    // connection cannot run two transactions concurrently, so this asserts the
    // same invariant sequentially: after a committed partial payment the balance
    // guard refuses a payment over the remaining balance and writes nothing, so
    // AP is never double-debited
    const { bookId, billId, cash } = await seedPostedBill(
      "org_bp_race",
      100,
      "B-4",
    );
    await recordBillPayment({
      billId,
      bookId,
      paymentAccountId: cash.id,
      date: "2026-09-10",
      amount: 70,
    });
    await expect(
      recordBillPayment({
        billId,
        bookId,
        paymentAccountId: cash.id,
        date: "2026-09-11",
        amount: 40,
      }),
    ).rejects.toThrow(/exceeds the balance/);

    const payments = await harness.db
      .select()
      .from(billPaymentTable)
      .where(eq(billPaymentTable.billId, billId));
    expect(payments).toHaveLength(1);
    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, billId));
    expect(bill).toMatchObject({ amountPaid: "70.0000", status: "partial" });
  });
});
