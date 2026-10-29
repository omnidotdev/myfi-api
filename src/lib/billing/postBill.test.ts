import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  billTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  taxJurisdictionTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Posting a bill writes the authoritative AP/expense entry, so exercise it
// against real Postgres: the expense debit (with US tax folded in), the AP
// credit, and the balanced journal lines are what the books read
let createBillDraft: typeof import("./createBillDraft").createBillDraft;
let postBill: typeof import("./postBill").postBill;
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

describe("postBill", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBillDraft } = await import("./createBillDraft"));
    ({ postBill } = await import("./postBill"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (
    organizationId: string,
    opts: { withAp?: boolean } = {},
  ) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Bill Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const ap = opts.withAp
      ? await seedAccount(bookId, "AP", "liability", "accounts_payable")
      : null;
    const supplies = await seedAccount(
      bookId,
      "Supplies",
      "expense",
      "operating_expense",
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
    const [vendor] = await harness.db
      .insert(vendorTable)
      .values({ bookId, name: "Supplier" })
      .returning();
    return {
      bookId,
      ap,
      supplies,
      payable,
      jurId: jur!.id,
      vendorId: vendor!.id,
    };
  };

  test("posts a draft bill: expense and tax debits, AP credit, bill opened", async () => {
    const { bookId, ap, supplies, payable, jurId, vendorId } = await seedBook(
      "org_bill_post",
      { withAp: true },
    );
    const draft = await createBillDraft({
      bookId,
      vendorId,
      number: "B-1",
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: supplies.id,
          taxJurisdictionId: jurId,
        },
      ],
    });

    const result = await postBill(draft.billId, bookId);

    const [entry] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.id, result.journalEntryId));
    expect(entry).toMatchObject({
      bookId,
      source: "bill",
      sourceReferenceId: draft.billId,
      vendorId,
      memo: "Bill B-1",
    });

    const lines = await linesForEntry(result.journalEntryId);
    // US treatment: tax paid folds into the expense debit, so there are only two
    // lines (expense incl. tax, and the AP credit), no tax-payable debit
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.accountId === ap!.id)).toMatchObject({
      credit: "108.2500",
      debit: "0.0000",
    });
    expect(lines.find((l) => l.accountId === supplies.id)).toMatchObject({
      debit: "108.2500",
    });
    expect(lines.some((l) => l.accountId === payable.id)).toBe(false);

    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, draft.billId));
    expect(bill).toMatchObject({ status: "open", total: "108.2500" });
    expect(result).toMatchObject({ total: 108.25, alreadyPosted: false });
  });

  test("is idempotent for an already-posted bill", async () => {
    const { bookId, supplies, vendorId } = await seedBook("org_bill_idem", {
      withAp: true,
    });
    const draft = await createBillDraft({
      bookId,
      vendorId,
      number: "B-2",
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 100,
          expenseAccountId: supplies.id,
        },
      ],
    });
    const first = await postBill(draft.billId, bookId);

    const again = await postBill(draft.billId, bookId);
    expect(again).toEqual({
      billId: draft.billId,
      journalEntryId: first.journalEntryId,
      total: 100,
      alreadyPosted: true,
    });
    const entries = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.sourceReferenceId, draft.billId));
    expect(entries).toHaveLength(1);
  });

  test("throws when the book has no Accounts Payable account", async () => {
    const { bookId, supplies, vendorId } = await seedBook("org_bill_noap");
    const draft = await createBillDraft({
      bookId,
      vendorId,
      number: "B-3",
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 10,
          expenseAccountId: supplies.id,
        },
      ],
    });
    await expect(postBill(draft.billId, bookId)).rejects.toThrow(
      /Accounts Payable/,
    );
    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, draft.billId));
    expect(bill?.status).toBe("draft");
  });

  test("throws on a cross-book bill (IDOR)", async () => {
    const { bookId, supplies, vendorId } = await seedBook("org_bill_idor", {
      withAp: true,
    });
    const other = await seedBook("org_bill_idor_other", { withAp: true });
    const draft = await createBillDraft({
      bookId,
      vendorId,
      number: "B-4",
      billDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 10,
          expenseAccountId: supplies.id,
        },
      ],
    });
    await expect(postBill(draft.billId, other.bookId)).rejects.toThrow(
      /not found/,
    );
  });
});
