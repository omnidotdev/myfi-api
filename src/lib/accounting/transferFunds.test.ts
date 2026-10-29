import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import { accountTable, bookTable, journalLineTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let transferFunds: typeof import("./transferFunds").transferFunds;
let harness: TestDb;

const acct = (bookId: string, name: string, subType: NonNullable<InsertAccount["subType"]>) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type: "asset", subType })
    .returning()
    .then((r) => r[0]!);

describe("transferFunds", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ transferFunds } = await import("./transferFunds"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("debits the destination and credits the source", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_xfer", name: "Xfer Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const checking = await acct(bookId, "Checking", "bank");
    const savings = await acct(bookId, "Savings", "bank");

    const result = await transferFunds({
      bookId,
      fromAccountId: checking.id,
      toAccountId: savings.id,
      amount: 500,
      date: "2026-03-01",
    });

    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId));
    expect(lines.find((l) => l.accountId === savings.id)?.debit).toBe("500.0000");
    expect(lines.find((l) => l.accountId === checking.id)?.credit).toBe("500.0000");
  });

  test("rejects a transfer to the same account and a cross-book account", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_xfer2", name: "Xfer Co 2", type: "llc" })
      .returning();
    const a = await acct(book!.id, "A", "bank");
    await expect(
      Promise.resolve(
        transferFunds({
          bookId: book!.id,
          fromAccountId: a.id,
          toAccountId: a.id,
          amount: 10,
          date: "2026-03-01",
        }),
      ),
    ).rejects.toThrow(/same account/);
    await expect(
      Promise.resolve(
        transferFunds({
          bookId: book!.id,
          fromAccountId: a.id,
          toAccountId: crypto.randomUUID(),
          amount: 10,
          date: "2026-03-01",
        }),
      ),
    ).rejects.toThrow(/belong to this book/);
  });
});
