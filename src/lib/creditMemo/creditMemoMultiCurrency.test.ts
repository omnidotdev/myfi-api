import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// A foreign-currency credit memo posts to the ledger in the book's home
// currency at the memo rate (the reverse of an invoice)
let createCreditMemoDraft: typeof import("./createCreditMemoDraft").createCreditMemoDraft;
let postCreditMemo: typeof import("./postCreditMemo").postCreditMemo;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "revenue",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("multi-currency credit memos", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createCreditMemoDraft } = await import("./createCreditMemoDraft"));
    ({ postCreditMemo } = await import("./postCreditMemo"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("a foreign credit memo posts to the ledger in home currency at its rate", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_cmmc", name: "CMMC Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Euro Buyer" })
      .returning();

    const draft = await createCreditMemoDraft({
      bookId,
      customerId: customer!.id,
      number: "CM-EUR",
      date: "2026-03-01",
      currency: "EUR",
      exchangeRate: 1.1,
      lines: [
        { description: "Credit", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    const posted = await postCreditMemo(draft.creditMemoId, bookId);

    // 100 EUR x 1.1 = 110 USD: income debited, AR credited (reverse of an invoice)
    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, posted.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(income.id)?.debit).toBe("110.0000");
    expect(byAccount(ar.id)?.credit).toBe("110.0000");
  });
});
