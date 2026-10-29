import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq, sql } from "drizzle-orm";

import {
  accountTable,
  billTable,
  bookTable,
  journalLineTable,
  taxJurisdictionTable,
  vendorCreditTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Vendor credits touch the ledger (reverse of a bill) and the AP subledger, so
// exercise create, post, apply, and void against real Postgres
let createVendorCreditDraft: typeof import("./createVendorCreditDraft").createVendorCreditDraft;
let postVendorCredit: typeof import("./postVendorCredit").postVendorCredit;
let applyVendorCredit: typeof import("./applyVendorCredit").applyVendorCredit;
let voidVendorCredit: typeof import("./voidVendorCredit").voidVendorCredit;
let createBillDraft: typeof import("lib/billing/createBillDraft").createBillDraft;
let postBill: typeof import("lib/billing/postBill").postBill;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "asset" | "liability" | "expense",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("vendor credits", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createVendorCreditDraft } = await import("./createVendorCreditDraft"));
    ({ postVendorCredit } = await import("./postVendorCredit"));
    ({ applyVendorCredit } = await import("./applyVendorCredit"));
    ({ voidVendorCredit } = await import("./voidVendorCredit"));
    ({ createBillDraft } = await import("lib/billing/createBillDraft"));
    ({ postBill } = await import("lib/billing/postBill"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("posting reverses a bill posting (debit AP, credit expense) and folds tax into expense", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_vc", name: "VC Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
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
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller" })
      .returning();

    const draft = await createVendorCreditDraft({
      bookId,
      vendorId: vendor!.id,
      number: "VC-1",
      date: "2026-03-01",
      lines: [
        {
          description: "Returned supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
          taxJurisdictionId: jur!.id,
        },
      ],
    });
    expect(draft.subtotal).toBe(100);

    const posted = await postVendorCredit(draft.vendorCreditId, bookId);
    // Tax is folded into the expense under US treatment, so total is 110
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
    // Reverse of a bill: AP is debited for the full total, expense is credited
    // for cost plus the sales tax paid (folded in); no separate tax-payable line
    expect(byAccount(ap.id)?.debit).toBe("110.0000");
    expect(byAccount(expense.id)?.credit).toBe("110.0000");
    expect(byAccount(payable.id)).toBeUndefined();

    // The entry balances
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
  });

  test("applying a vendor credit settles an open bill and nets AP to zero", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_vc2", name: "VC Co 2", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller" })
      .returning();

    // An open bill for 100 (no tax)
    const billDraft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-1",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postBill(billDraft.billId, bookId);

    // A vendor credit for 100, posted
    const vcDraft = await createVendorCreditDraft({
      bookId,
      vendorId: vendor!.id,
      number: "VC-2",
      date: "2026-03-05",
      lines: [
        {
          description: "Credit",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postVendorCredit(vcDraft.vendorCreditId, bookId);

    const applied = await applyVendorCredit({
      vendorCreditId: vcDraft.vendorCreditId,
      billId: billDraft.billId,
      bookId,
      amount: 100,
      date: "2026-03-06",
    });
    expect(applied.billStatus).toBe("paid");
    expect(applied.vendorCreditStatus).toBe("applied");

    const [bill] = await db
      .select()
      .from(billTable)
      .where(eq(billTable.id, billDraft.billId));
    expect(bill?.amountPaid).toBe("100.0000");
    const [vc] = await db
      .select()
      .from(vendorCreditTable)
      .where(eq(vendorCreditTable.id, vcDraft.vendorCreditId));
    expect(vc?.amountApplied).toBe("100.0000");

    // The bill credited AP 100 and the credit debited AP 100, so the account
    // nets to 0
    const [apBalance] = await db
      .select({
        net: sql<string>`coalesce(sum(${journalLineTable.debit}) - sum(${journalLineTable.credit}), 0)`,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.accountId, ap.id));
    expect(Number(apBalance?.net)).toBe(0);
  });

  test("applying across vendors is rejected", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_vc3", name: "VC Co 3", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const [vendorA] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller A" })
      .returning();
    const [vendorB] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller B" })
      .returning();

    const billDraft = await createBillDraft({
      bookId,
      vendorId: vendorA!.id,
      number: "BILL-X",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 50,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postBill(billDraft.billId, bookId);

    const vcDraft = await createVendorCreditDraft({
      bookId,
      vendorId: vendorB!.id,
      number: "VC-X",
      date: "2026-03-05",
      lines: [
        {
          description: "Credit",
          quantity: 1,
          unitPrice: 50,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postVendorCredit(vcDraft.vendorCreditId, bookId);

    await expect(
      applyVendorCredit({
        vendorCreditId: vcDraft.vendorCreditId,
        billId: billDraft.billId,
        bookId,
        amount: 50,
        date: "2026-03-06",
      }),
    ).rejects.toThrow("different vendors");
  });

  test("over-applying a vendor credit is rejected", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_vc4", name: "VC Co 4", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller" })
      .returning();

    const billDraft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-2",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 40,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postBill(billDraft.billId, bookId);

    const vcDraft = await createVendorCreditDraft({
      bookId,
      vendorId: vendor!.id,
      number: "VC-3",
      date: "2026-03-05",
      lines: [
        {
          description: "Credit",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postVendorCredit(vcDraft.vendorCreditId, bookId);

    // The credit has 100 left but the bill only owes 40, so 100 over-applies
    await expect(
      applyVendorCredit({
        vendorCreditId: vcDraft.vendorCreditId,
        billId: billDraft.billId,
        bookId,
        amount: 100,
        date: "2026-03-06",
      }),
    ).rejects.toThrow("bill's remaining balance");
  });

  test("void refuses once the credit is applied", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_vc5", name: "VC Co 5", type: "llc" })
      .returning();
    const bookId = book!.id;
    await acct(bookId, "AP", "liability", "accounts_payable");
    const expense = await acct(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
    );
    const [vendor] = await db
      .insert(vendorTable)
      .values({ bookId, name: "Seller" })
      .returning();

    const billDraft = await createBillDraft({
      bookId,
      vendorId: vendor!.id,
      number: "BILL-3",
      billDate: "2026-03-01",
      dueDate: "2026-04-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postBill(billDraft.billId, bookId);

    const vcDraft = await createVendorCreditDraft({
      bookId,
      vendorId: vendor!.id,
      number: "VC-4",
      date: "2026-03-05",
      lines: [
        {
          description: "Credit",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: expense.id,
        },
      ],
    });
    await postVendorCredit(vcDraft.vendorCreditId, bookId);
    await applyVendorCredit({
      vendorCreditId: vcDraft.vendorCreditId,
      billId: billDraft.billId,
      bookId,
      amount: 100,
      date: "2026-03-06",
    });

    await expect(
      voidVendorCredit(vcDraft.vendorCreditId, bookId, "2026-03-07"),
    ).rejects.toThrow("applied to bills");
  });
});
