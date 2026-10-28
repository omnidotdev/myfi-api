import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { eq, sql } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  creditMemoTable,
  customerTable,
  invoiceTable,
  journalLineTable,
  taxJurisdictionTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Credit memos touch the ledger (reverse of an invoice) and the AR subledger,
// so exercise create, post, and apply against real Postgres
let createCreditMemoDraft: typeof import("./createCreditMemoDraft").createCreditMemoDraft;
let postCreditMemo: typeof import("./postCreditMemo").postCreditMemo;
let applyCreditMemo: typeof import("./applyCreditMemo").applyCreditMemo;
let createInvoiceDraft: typeof import("lib/invoicing/createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("lib/invoicing/postInvoice").postInvoice;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "liability" | "revenue",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("credit memos", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createCreditMemoDraft } = await import("./createCreditMemoDraft"));
    ({ postCreditMemo } = await import("./postCreditMemo"));
    ({ applyCreditMemo } = await import("./applyCreditMemo"));
    ({ createInvoiceDraft } = await import("lib/invoicing/createInvoiceDraft"));
    ({ postInvoice } = await import("lib/invoicing/postInvoice"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("posting reverses an invoice posting (debit income and tax, credit AR)", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_cm", name: "CM Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const payable = await acct(bookId, "Tax", "liability", "other_liability");
    const [jur] = await db
      .insert(taxJurisdictionTable)
      .values({
        bookId,
        name: "State",
        rate: "0.100000",
        filingFrequency: "annually",
        taxPayableAccountId: payable.id,
      })
      .returning();
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const draft = await createCreditMemoDraft({
      bookId,
      customerId: customer!.id,
      number: "CM-1",
      date: "2026-03-01",
      lines: [
        {
          description: "Returned widget",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: income.id,
          taxJurisdictionId: jur!.id,
        },
      ],
    });
    expect(draft.subtotal).toBe(100);

    const posted = await postCreditMemo(draft.creditMemoId, bookId);
    expect(posted.total).toBe(110);

    const lines = await db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, posted.journalEntryId));
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // Reverse of an invoice: income and tax are debited, AR is credited
    expect(byAccount(income.id)?.debit).toBe("100.0000");
    expect(byAccount(payable.id)?.debit).toBe("10.0000");
    expect(byAccount(ar.id)?.credit).toBe("110.0000");
  });

  test("applying a credit memo settles an invoice and nets AR to zero", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_cm2", name: "CM Co 2", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ar = await acct(bookId, "AR", "asset", "accounts_receivable");
    const income = await acct(bookId, "Sales", "revenue", "sales");
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    // An open invoice for 100 (no tax)
    const invDraft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "INV-1",
      issueDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        { description: "Widget", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    await postInvoice(invDraft.invoiceId, bookId);

    // A credit memo for 100, posted
    const cmDraft = await createCreditMemoDraft({
      bookId,
      customerId: customer!.id,
      number: "CM-2",
      date: "2026-03-05",
      lines: [
        { description: "Credit", quantity: 1, unitPrice: 100, incomeAccountId: income.id },
      ],
    });
    await postCreditMemo(cmDraft.creditMemoId, bookId);

    const applied = await applyCreditMemo({
      creditMemoId: cmDraft.creditMemoId,
      invoiceId: invDraft.invoiceId,
      bookId,
      amount: 100,
      date: "2026-03-06",
    });
    expect(applied.invoiceStatus).toBe("paid");
    expect(applied.creditMemoStatus).toBe("applied");

    const [inv] = await db
      .select()
      .from(invoiceTable)
      .where(eq(invoiceTable.id, invDraft.invoiceId));
    expect(inv?.amountPaid).toBe("100.0000");
    const [cm] = await db
      .select()
      .from(creditMemoTable)
      .where(eq(creditMemoTable.id, cmDraft.creditMemoId));
    expect(cm?.amountApplied).toBe("100.0000");

    // The invoice debited AR 100 and the memo credited AR 100, so the account nets to 0
    const [arBalance] = await db
      .select({
        net: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.accountId, ar.id));
    expect(Number(arBalance?.net)).toBe(0);
  });
});
