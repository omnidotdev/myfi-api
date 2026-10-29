import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import { accountTable, bookTable, inventoryItemTable, journalLineTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let adjustInventory: typeof import("./adjustInventory").adjustInventory;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "expense",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("adjustInventory", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ adjustInventory } = await import("./adjustInventory"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("writes a shrinkage down to COGS and a count-up back to the asset", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_adj", name: "Adj Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const asset = await acct(bookId, "Inventory", "asset", "inventory");
    const cogs = await acct(bookId, "COGS", "expense", "cost_of_goods");
    const income = await acct(bookId, "Sales", "expense", "operating_expense");
    const [item] = await db
      .insert(inventoryItemTable)
      .values({
        bookId,
        name: "Widget",
        salePrice: "10.0000",
        quantityOnHand: "10.0000",
        averageCost: "5.0000",
        assetAccountId: asset.id,
        cogsAccountId: cogs.id,
        incomeAccountId: income.id,
      })
      .returning();

    // Count down to 8 (lose 2 at cost 5 = 10): DR COGS, CR asset
    const down = await adjustInventory({
      itemId: item!.id,
      bookId,
      newQuantityOnHand: 8,
      date: "2026-03-01",
    });
    expect(down.quantityOnHand).toBe(8);
    const dl = await db
      .select({ accountId: journalLineTable.accountId, debit: journalLineTable.debit, credit: journalLineTable.credit })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, down.journalEntryId as string));
    expect(dl.find((l) => l.accountId === cogs.id)?.debit).toBe("10.0000");
    expect(dl.find((l) => l.accountId === asset.id)?.credit).toBe("10.0000");

    // Count up to 12 (gain 4 at cost 5 = 20): DR asset, CR COGS
    const up = await adjustInventory({
      itemId: item!.id,
      bookId,
      newQuantityOnHand: 12,
      date: "2026-03-02",
    });
    const ul = await db
      .select({ accountId: journalLineTable.accountId, debit: journalLineTable.debit, credit: journalLineTable.credit })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, up.journalEntryId as string));
    expect(ul.find((l) => l.accountId === asset.id)?.debit).toBe("20.0000");
    expect(ul.find((l) => l.accountId === cogs.id)?.credit).toBe("20.0000");

    const [after] = await db
      .select({ qty: inventoryItemTable.quantityOnHand, avg: inventoryItemTable.averageCost })
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item!.id));
    expect(after?.qty).toBe("12.0000");
    expect(after?.avg).toBe("5.0000");
  });
});
