import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  inventoryItemTable,
  inventoryTransactionTable,
  invoiceTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Exercises the auto-COGS path of postInvoice against real Postgres: an invoice
// line that sells an inventory item posts DR COGS / CR inventory-asset at
// average cost, records a stock movement, and decrements the item
let createInvoiceDraft: typeof import("./createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("./postInvoice").postInvoice;
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

describe("postInvoice auto-COGS", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("./createInvoiceDraft"));
    ({ postInvoice } = await import("./postInvoice"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "COGS Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const asset = await seedAccount(bookId, "Inventory", "asset", "inventory");
    const cogs = await seedAccount(bookId, "COGS", "expense", "cost_of_goods");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    return { bookId, ar, sales, asset, cogs, customerId: customer!.id };
  };

  const seedItem = (
    bookId: string,
    accounts: { asset: string; cogs: string; income: string },
    opts: { averageCost: string; quantityOnHand: string },
  ) =>
    harness.db
      .insert(inventoryItemTable)
      .values({
        bookId,
        name: "Widget",
        assetAccountId: accounts.asset,
        cogsAccountId: accounts.cogs,
        incomeAccountId: accounts.income,
        averageCost: opts.averageCost,
        quantityOnHand: opts.quantityOnHand,
      })
      .returning()
      .then((r) => r[0]!);

  test("posts COGS, records the stock movement, and decrements the item", async () => {
    const { bookId, ar, sales, asset, cogs, customerId } =
      await seedBook("org_cogs");
    const item = await seedItem(
      bookId,
      { asset: asset.id, cogs: cogs.id, income: sales.id },
      { averageCost: "3", quantityOnHand: "10" },
    );

    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1001",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Widget",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: sales.id,
          inventoryItemId: item.id,
        },
      ],
    });

    const result = await postInvoice(draft.invoiceId, bookId);

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // AR debit 100, sales credit 100, plus COGS 6 debit and inventory 6 credit
    expect(byAccount(ar.id)?.debit).toBe("100.0000");
    expect(byAccount(cogs.id)).toMatchObject({
      debit: "6.0000",
      credit: "0.0000",
    });
    expect(byAccount(asset.id)).toMatchObject({
      debit: "0.0000",
      credit: "6.0000",
    });

    // one stock movement (sale of 2 at avg cost 3)
    const [txn] = await harness.db
      .select()
      .from(inventoryTransactionTable)
      .where(
        eq(inventoryTransactionTable.journalEntryId, result.journalEntryId),
      );
    expect(txn).toMatchObject({
      type: "sale",
      quantity: "-2.0000",
      unitCost: "3.0000",
    });

    // item decremented 10 -> 8
    const [updated] = await harness.db
      .select()
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.id, item.id));
    expect(updated?.quantityOnHand).toBe("8.0000");

    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("open");
  });

  test("throws when a line references an item from another book", async () => {
    const { bookId, sales, customerId } = await seedBook("org_cogs_main");
    const other = await seedBook("org_cogs_other");
    const foreignItem = await seedItem(
      other.bookId,
      { asset: other.asset.id, cogs: other.cogs.id, income: other.sales.id },
      { averageCost: "3", quantityOnHand: "10" },
    );

    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1002",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Widget",
          quantity: 1,
          unitPrice: 50,
          incomeAccountId: sales.id,
          inventoryItemId: foreignItem.id,
        },
      ],
    });

    await expect(postInvoice(draft.invoiceId, bookId)).rejects.toThrow(
      /not in this book/,
    );
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("draft");
  });
});
