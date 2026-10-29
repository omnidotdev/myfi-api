import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  accountingPeriodTable,
  billTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Voiding a bill posts a dated reversing entry rather than deleting the
// original, so exercise it against real Postgres: the swapped debit/credit
// lines, the closed-period refusal, and the payment guard are money-critical
let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let postBill: typeof import("./postBill").postBill;
let recordBillPayment: typeof import("./recordBillPayment").recordBillPayment;
let voidBill: typeof import("./voidBill").voidBill;
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

describe("voidBill", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBillDraft } = await import("./createBillDraft"));
    ({ postBill } = await import("./postBill"));
    ({ recordBillPayment } = await import("./recordBillPayment"));
    ({ voidBill } = await import("./voidBill"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Void Bill Co", type: "llc" })
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
    return { bookId, ap, supplies, cash, vendorId: vendor!.id };
  };

  const draftFor = (
    bookId: string,
    vendorId: string,
    expenseAccountId: string,
    number: string,
    billDate = "2026-09-01",
  ) =>
    createBillDraft({
      bookId,
      vendorId,
      number,
      billDate,
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId,
        },
      ],
    });

  test("posts a reversing entry (not a delete) and marks a posted bill void", async () => {
    const { bookId, ap, supplies, vendorId } = await seedBook("org_vb");
    const draft = await draftFor(bookId, vendorId, supplies.id, "B-1");
    await postBill(draft.billId, bookId);

    const result = await voidBill(draft.billId, bookId);

    const [reversal] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.source, "bill_void"));
    expect(reversal).toMatchObject({ sourceReferenceId: draft.billId });

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, reversal!.id));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // The original expense debit becomes a credit, the AP credit becomes a debit
    expect(byAccount(supplies.id)).toMatchObject({
      debit: "0.0000",
      credit: "100.0000",
    });
    expect(byAccount(ap.id)).toMatchObject({
      debit: "100.0000",
      credit: "0.0000",
    });

    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, draft.billId));
    expect(bill?.status).toBe("void");
    expect(result).toEqual({ billId: draft.billId, alreadyVoid: false });
  });

  test("refuses to reverse into a closed period", async () => {
    const { bookId, supplies, vendorId } = await seedBook("org_vb_closed");
    const today = new Date();
    await harness.db.insert(accountingPeriodTable).values({
      bookId,
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
      status: "closed",
    });
    const past = new Date(today.getTime() - 70 * 24 * 60 * 60 * 1000);
    const billDate = `${past.getUTCFullYear()}-${String(
      past.getUTCMonth() + 1,
    ).padStart(2, "0")}-01`;
    const draft = await draftFor(
      bookId,
      vendorId,
      supplies.id,
      "B-2",
      billDate,
    );
    await postBill(draft.billId, bookId);

    await expect(voidBill(draft.billId, bookId)).rejects.toThrow(
      /closed period/,
    );
    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, draft.billId));
    expect(bill?.status).toBe("open");
  });

  test("refuses to void a bill with payments", async () => {
    const { bookId, supplies, cash, vendorId } = await seedBook("org_vb_paid");
    const draft = await draftFor(bookId, vendorId, supplies.id, "B-3");
    await postBill(draft.billId, bookId);
    await recordBillPayment({
      billId: draft.billId,
      bookId,
      paymentAccountId: cash.id,
      date: "2026-09-10",
      amount: 40,
    });

    await expect(voidBill(draft.billId, bookId)).rejects.toThrow(/payments/);
  });

  test("is a no-op on an already-void bill", async () => {
    const { bookId, supplies, vendorId } = await seedBook("org_vb_again");
    const draft = await draftFor(bookId, vendorId, supplies.id, "B-4");
    await postBill(draft.billId, bookId);
    await voidBill(draft.billId, bookId);

    const result = await voidBill(draft.billId, bookId);
    expect(result).toEqual({ billId: draft.billId, alreadyVoid: true });
  });
});
