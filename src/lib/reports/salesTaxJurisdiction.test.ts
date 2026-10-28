import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceLineTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Exercises the real invoice posting and the sales-tax report together against
// PGlite, proving tax is attributed per jurisdiction even when jurisdictions
// share one GL payable account (the double-counting bug)
let postInvoice: typeof import("lib/invoicing/postInvoice").postInvoice;
let generateSalesTaxReport: typeof import("./salesTax").default;
let harness: TestDb;

const seedAccount = async (
  db: TestDb["db"],
  bookId: string,
  name: string,
  type: "asset" | "liability" | "revenue",
  subType: NonNullable<InsertAccount["subType"]>,
) => {
  const [acct] = await db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning();
  return acct!;
};

describe("sales tax attribution across shared payable accounts", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ postInvoice } = await import("lib/invoicing/postInvoice"));
    ({ default: generateSalesTaxReport } = await import("./salesTax"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("two jurisdictions sharing one payable account do not double-count", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_tax", name: "Tax Co", type: "llc" })
      .returning();
    const bookId = book!.id;

    // AR account is resolved by postInvoice via its subtype, so seed it without
    // binding the result
    await seedAccount(db, bookId, "AR", "asset", "accounts_receivable");
    const income = await seedAccount(db, bookId, "Sales", "revenue", "sales");
    // One GL payable account shared by both jurisdictions (the misconfiguration
    // that silently double-counted)
    const payable = await seedAccount(
      db,
      bookId,
      "Sales Tax Payable",
      "liability",
      "other_liability",
    );

    const [state] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "State",
        rate: "0.100000",
        filingFrequency: "annually",
        taxPayableAccountId: payable.id,
      })
      .returning();
    const [county] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "County",
        rate: "0.200000",
        filingFrequency: "annually",
        taxPayableAccountId: payable.id,
      })
      .returning();

    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const makeInvoice = async (number: string, jurisdictionId: string) => {
      const [inv] = await db
        .insert(invoiceTable)
        .values({
          bookId,
          customerId: customer!.id,
          number,
          status: "draft",
          issueDate: "2026-03-15",
          dueDate: "2026-04-15",
        })
        .returning();
      await db.insert(invoiceLineTable).values({
        invoiceId: inv!.id,
        description: "Widget",
        quantity: "1",
        unitPrice: "100.0000",
        incomeAccountId: income.id,
        taxJurisdictionId: jurisdictionId,
      });
      return inv!.id;
    };

    const invState = await makeInvoice("INV-STATE", state!.id);
    const invCounty = await makeInvoice("INV-COUNTY", county!.id);
    await postInvoice(invState, bookId);
    await postInvoice(invCounty, bookId);

    const report = await generateSalesTaxReport({ bookId, year: 2026 });
    const stateRow = report.jurisdictions.find((j) => j.name === "State");
    const countyRow = report.jurisdictions.find((j) => j.name === "County");

    // State tax is 10% of 100 = 10; County is 20% of 100 = 20. Each jurisdiction
    // sees only its own tax, not the combined 30 on the shared account
    expect(stateRow?.totalCollected).toBe("10.0000");
    expect(countyRow?.totalCollected).toBe("20.0000");
  });

  test("a dedicated account still counts untagged legacy credits (no regression)", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_tax2", name: "Tax Co 2", type: "llc" })
      .returning();
    const bookId = book!.id;
    const payable = await seedAccount(
      db,
      bookId,
      "City Tax Payable",
      "liability",
      "other_liability",
    );
    await db.insert(taxJurisdictionTable).values({
      bookId,
      name: "City",
      rate: "0.050000",
      filingFrequency: "annually",
      taxPayableAccountId: payable.id,
    });

    // A manual tax credit with no jurisdiction tag (legacy shape) on a
    // dedicated account must still be attributed to the sole owning jurisdiction
    const [entry] = await db
      .insert(journalEntryTable)
      .values({ bookId, date: "2026-06-01T00:00:00.000Z" })
      .returning();
    await db.insert(journalLineTable).values({
      journalEntryId: entry!.id,
      accountId: payable.id,
      debit: "0",
      credit: "42.0000",
    });

    const report = await generateSalesTaxReport({ bookId, year: 2026 });
    const cityRow = report.jurisdictions.find((j) => j.name === "City");
    expect(cityRow?.totalCollected).toBe("42.0000");
  });
});
