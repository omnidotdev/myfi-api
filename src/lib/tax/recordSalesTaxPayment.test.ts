import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

let recordSalesTaxPayment: typeof import("./recordSalesTaxPayment").recordSalesTaxPayment;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "liability",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("recordSalesTaxPayment", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ recordSalesTaxPayment } = await import("./recordSalesTaxPayment"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("debits the tax-payable liability and credits the bank", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_stp", name: "STP Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const payable = await acct(bookId, "Sales Tax Payable", "liability", "other_liability");
    const bank = await acct(bookId, "Bank", "asset", "bank");
    const [jur] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "State",
        rate: "0.080000",
        filingFrequency: "quarterly",
        taxPayableAccountId: payable.id,
      })
      .returning();

    const result = await recordSalesTaxPayment({
      bookId,
      jurisdictionId: jur!.id,
      amount: 250,
      paymentAccountId: bank.id,
      date: "2026-04-15",
    });

    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId));
    expect(lines.find((l) => l.accountId === payable.id)?.debit).toBe("250.0000");
    expect(lines.find((l) => l.accountId === bank.id)?.credit).toBe("250.0000");
  });
});
