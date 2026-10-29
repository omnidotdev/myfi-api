import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { accountTable, bookTable, vendorTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let payBillsBatch: typeof import("./payBillsBatch").payBillsBatch;
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

describe("payBillsBatch", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ payBillsBatch } = await import("./payBillsBatch"));
    ({ createBillDraft } = await import("./createBillDraft"));
    ({ postBill } = await import("./postBill"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("pays several posted bills from one account in one call", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_pbb", name: "PBB Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(bookId, "Supplies", "expense", "operating_expense");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Acme" })
      .returning();

    const mkBill = async (number: string) => {
      const draft = await createBillDraft({
        bookId,
        vendorId: vendor!.id,
        number,
        billDate: "2026-03-01",
        dueDate: "2026-04-01",
        lines: [{ description: "x", quantity: 1, unitPrice: 100, expenseAccountId: expense.id }],
      });
      await postBill(draft.billId, bookId);
      return draft.billId;
    };
    const b1 = await mkBill("B-1");
    const b2 = await mkBill("B-2");

    const result = await payBillsBatch({
      bookId,
      paymentAccountId: bank.id,
      date: "2026-04-01",
      payments: [
        { billId: b1, amount: 100 },
        { billId: b2, amount: 100 },
      ],
    });
    expect(result.totalPaid).toBe(200);
    expect(result.results.every((r) => r.billStatus === "paid")).toBe(true);
  });
});
