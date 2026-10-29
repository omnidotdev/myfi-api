import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let revalueForeignBalances: typeof import("./revalueForeignBalances").revalueForeignBalances;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

const linesFor = (entryId: string) =>
  harness.db
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, entryId));

describe("revalueForeignBalances", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ revalueForeignBalances } = await import("./revalueForeignBalances"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("revalues an open foreign receivable and posts a reversing entry", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_fxr", name: "FXR Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Euro Buyer" })
      .returning();
    // An open 100 EUR invoice booked at 1.10 (110 USD on the books)
    await db.insert(invoiceTable).values({
      bookId,
      customerId: customer!.id,
      number: "INV-FX",
      status: "open",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      currency: "EUR",
      exchangeRate: "1.10000000",
      subtotal: "100.0000",
      total: "100.0000",
      amountPaid: "0.0000",
    });

    // At period end the rate is 1.20: the receivable is worth 120 USD, a 10 USD
    // unrealized gain
    const result = await revalueForeignBalances({
      bookId,
      asOfDate: "2026-03-31",
      rates: { EUR: 1.2 },
    });
    expect(result.netGainLoss).toBe(10);
    expect(result.adjustmentEntryId).not.toBeNull();
    expect(result.reversalEntryId).not.toBeNull();

    const adj = await linesFor(result.adjustmentEntryId as string);
    const fx = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.subType, "fx_gain_loss"));
    const fxId = fx[0]!.id;
    expect(adj.find((l) => l.accountId === ar.id)?.debit).toBe("10.0000");
    expect(adj.find((l) => l.accountId === fxId)?.credit).toBe("10.0000");

    // The reversal nets it back out the next day
    const rev = await linesFor(result.reversalEntryId as string);
    expect(rev.find((l) => l.accountId === ar.id)?.credit).toBe("10.0000");
    expect(rev.find((l) => l.accountId === fxId)?.debit).toBe("10.0000");
  });

  test("is a no-op when there are no open foreign balances", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_fxr2", name: "FXR Co 2", type: "llc" })
      .returning();
    const result = await revalueForeignBalances({
      bookId: book!.id,
      asOfDate: "2026-03-31",
      rates: { EUR: 1.2 },
    });
    expect(result.adjustmentEntryId).toBeNull();
    expect(result.netGainLoss).toBe(0);
  });
});
