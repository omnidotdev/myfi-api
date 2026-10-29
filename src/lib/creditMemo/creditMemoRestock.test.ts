import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  inventoryItemTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// A credit memo for returned goods must add the stock back and reverse the COGS,
// so exercise post + void against real Postgres
let createCreditMemoDraft: typeof import("./createCreditMemoDraft").createCreditMemoDraft;
let postCreditMemo: typeof import("./postCreditMemo").postCreditMemo;
let voidCreditMemo: typeof import("./voidCreditMemo").voidCreditMemo;
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

describe("credit memo inventory restock", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createCreditMemoDraft } = await import("./createCreditMemoDraft"));
    ({ postCreditMemo } = await import("./postCreditMemo"));
    ({ voidCreditMemo } = await import("./voidCreditMemo"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("restocks returned goods on post and unstocks them on void", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_cmr", name: "CMR Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const asset = await acct(bookId, "Inventory", "asset", "inventory");
    const cogs = await acct(bookId, "COGS", "expense", "cost_of_goods");
    const [item] = await db
      .insert(inventoryItemTable)
      .values({
        bookId,
        name: "Widget",
        salePrice: "10.0000",
        quantityOnHand: "5.0000",
        averageCost: "4.0000",
        assetAccountId: asset.id,
        cogsAccountId: cogs.id,
        incomeAccountId: income.id,
      })
      .returning();
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const draft = await createCreditMemoDraft({
      bookId,
      customerId: customer!.id,
      number: "CM-RET",
      date: "2026-03-01",
      lines: [
        {
          description: "Returned widgets",
          quantity: 2,
          unitPrice: 10,
          incomeAccountId: income.id,
          inventoryItemId: item!.id,
        },
      ],
    });
    const posted = await postCreditMemo(draft.creditMemoId, bookId);

    // Stock went from 5 to 7 (2 returned)
    const afterPost = await db
      .select({ qty: inventoryItemTable.quantityOnHand })
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item!.id));
    expect(afterPost[0]?.qty).toBe("7.0000");

    // Restock pair: debit the inventory asset and credit COGS at 2 x 4 = 8
    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, posted.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    expect(byAccount(asset.id)?.debit).toBe("8.0000");
    expect(byAccount(cogs.id)?.credit).toBe("8.0000");
    // And the AR/revenue reversal is still present (DR income 20, CR AR 20)
    expect(byAccount(income.id)?.debit).toBe("20.0000");
    expect(byAccount(ar.id)?.credit).toBe("20.0000");

    await voidCreditMemo(draft.creditMemoId, bookId, "2026-03-05");

    // Void pulls the 2 back off hand, returning to 5
    const afterVoid = await db
      .select({ qty: inventoryItemTable.quantityOnHand })
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item!.id));
    expect(afterVoid[0]?.qty).toBe("5.0000");
  });
});
