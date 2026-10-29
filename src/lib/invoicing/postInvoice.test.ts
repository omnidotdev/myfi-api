import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Posting an invoice writes the authoritative ledger entry, so exercise it
// against real Postgres: the AR debit, income/tax credits, and the balanced
// journal lines are what the books read, not a displayed figure
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

const linesForEntry = (journalEntryId: string) =>
  harness.db
    .select({
      accountId: journalLineTable.accountId,
      debit: journalLineTable.debit,
      credit: journalLineTable.credit,
    })
    .from(journalLineTable)
    .where(eq(journalLineTable.journalEntryId, journalEntryId));

describe("postInvoice", () => {
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

  const seedBook = async (
    organizationId: string,
    opts: { withAr?: boolean } = {},
  ) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Post Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = opts.withAr
      ? await seedAccount(bookId, "AR", "asset", "accounts_receivable")
      : null;
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const service = await seedAccount(
      bookId,
      "Service",
      "revenue",
      "service_revenue",
    );
    const payable = await seedAccount(
      bookId,
      "Tax Payable",
      "liability",
      "other_liability",
    );
    const [jur] = await harness.db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "State",
        rate: "0.082500",
        filingFrequency: "annually",
        taxPayableAccountId: payable.id,
      })
      .returning();
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    return {
      bookId,
      ar,
      sales,
      service,
      payable,
      jurId: jur!.id,
      customerId: customer!.id,
    };
  };

  test("posts a draft invoice: AR debit, income and tax credits, invoice opened", async () => {
    const { bookId, ar, sales, service, payable, jurId, customerId } =
      await seedBook("org_post", { withAr: true });

    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1001",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Design",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: sales.id,
          taxJurisdictionId: jurId,
        },
        {
          description: "Hosting",
          quantity: 1,
          unitPrice: 30,
          incomeAccountId: service.id,
        },
      ],
    });

    const result = await postInvoice(draft.invoiceId, bookId);

    const [entry] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.id, result.journalEntryId));
    expect(entry).toMatchObject({
      bookId,
      source: "invoice",
      sourceReferenceId: draft.invoiceId,
      memo: "Invoice 1001",
    });

    const lines = await linesForEntry(result.journalEntryId);
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // AR debit + sales credit + service credit + tax credit = 4 lines
    expect(lines).toHaveLength(4);
    // 100 (2x50) + 30 + 8.25 tax = 138.25
    expect(byAccount(ar!.id)).toMatchObject({
      debit: "138.2500",
      credit: "0.0000",
    });
    expect(byAccount(sales.id)?.credit).toBe("100.0000");
    expect(byAccount(service.id)?.credit).toBe("30.0000");
    expect(byAccount(payable.id)?.credit).toBe("8.2500");

    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice).toMatchObject({
      status: "open",
      subtotal: "130.0000",
      taxAmount: "8.2500",
      total: "138.2500",
      journalEntryId: result.journalEntryId,
    });
    expect(result).toMatchObject({ total: 138.25, alreadyPosted: false });
  });

  test("is idempotent: an already-posted invoice is a no-op", async () => {
    const { bookId, sales, jurId, customerId } = await seedBook(
      "org_post_idem",
      {
        withAr: true,
      },
    );
    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1002",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Design",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: sales.id,
          taxJurisdictionId: jurId,
        },
      ],
    });
    const first = await postInvoice(draft.invoiceId, bookId);

    const again = await postInvoice(draft.invoiceId, bookId);
    expect(again).toEqual({
      invoiceId: draft.invoiceId,
      journalEntryId: first.journalEntryId,
      total: 108.25,
      alreadyPosted: true,
    });
    // Re-posting writes no second journal entry
    const entries = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.sourceReferenceId, draft.invoiceId));
    expect(entries).toHaveLength(1);
  });

  test("throws when the book has no Accounts Receivable account", async () => {
    const { bookId, sales, customerId } = await seedBook("org_post_noar");
    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1003",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Design",
          quantity: 1,
          unitPrice: 10,
          incomeAccountId: sales.id,
        },
      ],
    });
    await expect(postInvoice(draft.invoiceId, bookId)).rejects.toThrow(
      /Accounts Receivable/,
    );
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("draft");
  });

  test("throws when the invoice does not exist", async () => {
    await expect(
      postInvoice("00000000-0000-0000-0000-000000000000", "book-1"),
    ).rejects.toThrow(/not found/);
  });

  test("throws on a cross-book invoice (IDOR)", async () => {
    const { bookId, sales, customerId } = await seedBook("org_post_idor", {
      withAr: true,
    });
    const other = await seedBook("org_post_idor_other", { withAr: true });
    const draft = await createInvoiceDraft({
      bookId,
      customerId,
      number: "1004",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Design",
          quantity: 1,
          unitPrice: 10,
          incomeAccountId: sales.id,
        },
      ],
    });
    await expect(postInvoice(draft.invoiceId, other.bookId)).rejects.toThrow(
      /not found/,
    );
    const [invoice] = await harness.db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, draft.invoiceId));
    expect(invoice?.status).toBe("draft");
  });

  test("throws when a draft invoice has no lines", async () => {
    const { bookId, customerId } = await seedBook("org_post_nolines", {
      withAr: true,
    });
    // Insert a draft invoice directly with no lines, which the draft-creation
    // path would never produce, to exercise the empty-lines guard in posting
    const [invoice] = await harness.db
      .insert(invoiceTable)
      .values({
        bookId,
        customerId,
        number: "1005",
        status: "draft",
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
      })
      .returning();
    await expect(postInvoice(invoice!.id, bookId)).rejects.toThrow(/no lines/);
  });
});
