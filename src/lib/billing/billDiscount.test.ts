import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  journalLineTable,
  taxJurisdictionTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let postBill: typeof import("./postBill").postBill;
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

describe("bill line discounts", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBillDraft } = await import("./createBillDraft"));
    ({ postBill } = await import("./postBill"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("discounts the expense before folding in tax", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_bd", name: "BD Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(bookId, "Supplies", "expense", "operating_expense");
    const payable = await acct(bookId, "Tax", "liability", "other_liability");
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
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Acme" })
      .returning();

    const draft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-DISC",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Parts",
          quantity: 1,
          unitPrice: 100,
          discountPercent: 0.1,
          expenseAccountId: expense.id,
          taxJurisdictionId: jur!.id,
        },
      ],
    });
    expect(draft.subtotal).toBe(90);

    const posted = await postBill(draft.billId, bookId);
    // Net 90 plus 10% tax folded into the expense = 99
    expect(posted.total).toBe(99);

    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, posted.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // US treatment folds tax into the expense debit; AP is credited the total
    expect(byAccount(expense.id)?.debit).toBe("99.0000");
    expect(byAccount(ap.id)?.credit).toBe("99.0000");
  });
});
