import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { and, eq, ne } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  inventoryItemTable,
  inventoryTransactionTable,
  journalEntryTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Exercises voidInvoice returning sold inventory to stock against real Postgres:
// the original sale movement is offset (not deleted) and the item's on-hand
// quantity is restocked
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
let voidInvoice: typeof import("./voidInvoice").voidInvoice;
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

describe("voidInvoice restock", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
    ({ postInvoice } = await import("./postInvoice"));
    ({ voidInvoice } = await import("./voidInvoice"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("returns sold inventory to stock with an offsetting movement", async () => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({
        organizationId: "org_restock",
        name: "Restock Co",
        type: "llc",
      })
      .returning();
    const bookId = book!.id;
    await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const asset = await seedAccount(bookId, "Inventory", "asset", "inventory");
    const cogs = await seedAccount(bookId, "COGS", "expense", "cost_of_goods");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    const [item] = await harness.db
      .insert(inventoryItemTable)
      .values({
        bookId,
        name: "Widget",
        assetAccountId: asset.id,
        cogsAccountId: cogs.id,
        incomeAccountId: sales.id,
        averageCost: "5",
        quantityOnHand: "10",
      })
      .returning();

    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "1001",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Widget",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: sales.id,
          inventoryItemId: item!.id,
        },
      ],
    });
    await postInvoice(draft.invoiceId, bookId);
    // Sale decremented the item 10 -> 8
    const [afterSale] = await harness.db
      .select()
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item!.id));
    expect(afterSale?.quantityOnHand).toBe("8.0000");

    const result = await voidInvoice(draft.invoiceId, bookId);

    // 8 on hand + 2 returned = 10
    const [afterVoid] = await harness.db
      .select()
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item!.id));
    expect(afterVoid?.quantityOnHand).toBe("10.0000");

    // An offsetting (+2) movement is posted against the reversal entry rather
    // than deleting the original sale movement
    const [reversal] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.source, "invoice_void"));
    const offsetting = await harness.db
      .select({
        itemId: inventoryTransactionTable.itemId,
        quantity: inventoryTransactionTable.quantity,
        journalEntryId: inventoryTransactionTable.journalEntryId,
      })
      .from(inventoryTransactionTable)
      .where(eq(inventoryTransactionTable.journalEntryId, reversal!.id));
    expect(offsetting).toEqual([
      expect.objectContaining({
        itemId: item!.id,
        quantity: "2.0000",
        journalEntryId: reversal!.id,
      }),
    ]);
    // The original sale movement is still present (not deleted)
    const original = await harness.db
      .select()
      .from(inventoryTransactionTable)
      .where(
        and(
          eq(inventoryTransactionTable.itemId, item!.id),
          ne(inventoryTransactionTable.journalEntryId, reversal!.id),
        ),
      );
    expect(original).toHaveLength(1);
    expect(original[0]?.quantity).toBe("-2.0000");

    expect(result).toEqual({ invoiceId: draft.invoiceId, alreadyVoid: false });
  });
});
