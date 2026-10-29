import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { and, eq } from "drizzle-orm";

import {
  accountTable,
  bankDepositTable,
  bookTable,
  customerTable,
  invoicePaymentTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Bank deposits group payments held in Undeposited Funds into one bank line, so
// exercise the posting against real Postgres: it moves money between two of the
// book's asset accounts and must relieve Undeposited Funds exactly
let createInvoiceDraft: typeof import("lib/invoicing/createInvoiceDraft").createInvoiceDraft;
let postInvoice: typeof import("lib/invoicing/postInvoice").postInvoice;
let recordInvoicePayment: typeof import("lib/invoicing/recordInvoicePayment").recordInvoicePayment;
let createBankDeposit: typeof import("./createBankDeposit").createBankDeposit;
let voidBankDeposit: typeof import("./voidBankDeposit").voidBankDeposit;
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

describe("createBankDeposit / voidBankDeposit", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createInvoiceDraft } = await import("lib/invoicing/createInvoiceDraft"));
    ({ postInvoice } = await import("lib/invoicing/postInvoice"));
    ({ recordInvoicePayment } = await import(
      "lib/invoicing/recordInvoicePayment"
    ));
    ({ createBankDeposit } = await import("./createBankDeposit"));
    ({ voidBankDeposit } = await import("./voidBankDeposit"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  // Seed a book with a bank account and `count` fully-paid invoices whose
  // receipts were held in Undeposited Funds, returning their payment ids
  const seedUndepositedPayments = async (
    organizationId: string,
    amounts: number[],
  ) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Deposit Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    await seedAccount(bookId, "AR", "asset", "accounts_receivable");
    const sales = await seedAccount(bookId, "Sales", "revenue", "sales");
    const bank = await seedAccount(bookId, "Checking", "asset", "bank");
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();

    const paymentIds: string[] = [];
    let n = 1000;
    for (const amount of amounts) {
      const draft = await createInvoiceDraft({
        bookId,
        customerId: customer!.id,
        number: `D${n++}`,
        issueDate: "2026-09-01",
        dueDate: "2026-10-01",
        lines: [
          {
            description: "Work",
            quantity: 1,
            unitPrice: amount,
            incomeAccountId: sales.id,
          },
        ],
      });
      await postInvoice(draft.invoiceId, bookId);
      const pay = await recordInvoicePayment({
        invoiceId: draft.invoiceId,
        bookId,
        toUndepositedFunds: true,
        date: "2026-09-10",
        amount,
      });
      paymentIds.push(pay.paymentId);
    }
    const [uf] = await harness.db
      .select()
      .from(accountTable)
      .where(
        and(
          eq(accountTable.bookId, bookId),
          eq(accountTable.subType, "undeposited_funds"),
        ),
      );
    return { bookId, bankId: bank.id, ufId: uf?.id ?? "", paymentIds };
  };

  test("groups undeposited payments into one bank line", async () => {
    const { bookId, bankId, ufId, paymentIds } = await seedUndepositedPayments(
      "org_dep_group",
      [40, 60],
    );

    const result = await createBankDeposit({
      bookId,
      date: "2026-09-12",
      bankAccountId: bankId,
      paymentIds,
      memo: "Friday deposit",
    });

    expect(result.total).toBe(100);

    const [deposit] = await harness.db
      .select()
      .from(bankDepositTable)
      .where(eq(bankDepositTable.id, result.depositId));
    expect(deposit).toMatchObject({
      bookId,
      total: "100.0000",
      status: "recorded",
      bankAccountId: bankId,
      journalEntryId: result.journalEntryId,
    });

    const lines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, result.journalEntryId));
    expect(lines).toHaveLength(2);
    const byAccount = (id: string) => lines.find((l) => l.accountId === id);
    // DR bank 100, CR undeposited funds 100
    expect(byAccount(bankId)).toMatchObject({
      debit: "100.0000",
      credit: "0.0000",
    });
    expect(byAccount(ufId)).toMatchObject({
      debit: "0.0000",
      credit: "100.0000",
    });

    // both payments now point at the deposit
    const payments = await harness.db
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.bankDepositId, result.depositId));
    expect(payments).toHaveLength(2);
    expect(new Set(payments.map((p) => p.id))).toEqual(new Set(paymentIds));
  });

  test("rejects a payment already in a deposit", async () => {
    const { bookId, bankId, paymentIds } = await seedUndepositedPayments(
      "org_dep_dup",
      [25],
    );
    await createBankDeposit({
      bookId,
      date: "2026-09-12",
      bankAccountId: bankId,
      paymentIds,
    });
    await expect(
      createBankDeposit({
        bookId,
        date: "2026-09-13",
        bankAccountId: bankId,
        paymentIds,
      }),
    ).rejects.toThrow(/not available to deposit|already/i);
  });

  test("rejects a payment deposited straight to a bank account", async () => {
    const { bookId } = await seedUndepositedPayments("org_dep_direct", []);
    const sales = await harness.db
      .select()
      .from(accountTable)
      .where(
        and(eq(accountTable.bookId, bookId), eq(accountTable.subType, "sales")),
      )
      .then((r) => r[0]!);
    const bank = await harness.db
      .select()
      .from(accountTable)
      .where(
        and(eq(accountTable.bookId, bookId), eq(accountTable.subType, "bank")),
      )
      .then((r) => r[0]!);
    const [customer] = await harness.db
      .insert(customerTable)
      .values({ bookId, name: "Buyer2" })
      .returning();
    const draft = await createInvoiceDraft({
      bookId,
      customerId: customer!.id,
      number: "DX1",
      issueDate: "2026-09-01",
      dueDate: "2026-10-01",
      lines: [
        {
          description: "Work",
          quantity: 1,
          unitPrice: 30,
          incomeAccountId: sales.id,
        },
      ],
    });
    await postInvoice(draft.invoiceId, bookId);
    const pay = await recordInvoicePayment({
      invoiceId: draft.invoiceId,
      bookId,
      depositAccountId: bank.id,
      date: "2026-09-10",
      amount: 30,
    });
    await expect(
      createBankDeposit({
        bookId,
        date: "2026-09-12",
        bankAccountId: bank.id,
        paymentIds: [pay.paymentId],
      }),
    ).rejects.toThrow(/not available to deposit/i);
  });

  test("rejects a cross-book payment (IDOR)", async () => {
    const a = await seedUndepositedPayments("org_dep_a", [10]);
    const b = await seedUndepositedPayments("org_dep_b", [10]);
    await expect(
      createBankDeposit({
        bookId: b.bookId,
        date: "2026-09-12",
        bankAccountId: b.bankId,
        paymentIds: a.paymentIds,
      }),
    ).rejects.toThrow(/not available to deposit/i);
  });

  test("rejects an empty payment list", async () => {
    const { bookId, bankId } = await seedUndepositedPayments(
      "org_dep_empty",
      [],
    );
    await expect(
      createBankDeposit({
        bookId,
        date: "2026-09-12",
        bankAccountId: bankId,
        paymentIds: [],
      }),
    ).rejects.toThrow(/at least one payment/i);
  });

  test("void reverses the deposit and releases the payments", async () => {
    const { bookId, bankId, ufId, paymentIds } = await seedUndepositedPayments(
      "org_dep_void",
      [50],
    );
    const dep = await createBankDeposit({
      bookId,
      date: "2026-09-12",
      bankAccountId: bankId,
      paymentIds,
    });

    const voided = await voidBankDeposit(dep.depositId, bookId);

    // reversing entry: DR undeposited funds 50, CR bank 50
    const rlines = await harness.db
      .select({
        accountId: journalLineTable.accountId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
      })
      .from(journalLineTable)
      .where(eq(journalLineTable.journalEntryId, voided.reversalEntryId));
    const byAccount = (id: string) => rlines.find((l) => l.accountId === id);
    expect(byAccount(ufId)).toMatchObject({
      debit: "50.0000",
      credit: "0.0000",
    });
    expect(byAccount(bankId)).toMatchObject({
      debit: "0.0000",
      credit: "50.0000",
    });

    const [deposit] = await harness.db
      .select()
      .from(bankDepositTable)
      .where(eq(bankDepositTable.id, dep.depositId));
    expect(deposit?.status).toBe("void");

    // the payment is released back to undeposited funds and can be redeposited
    const [payment] = await harness.db
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.id, paymentIds[0] as string));
    expect(payment?.bankDepositId).toBeNull();

    const redeposit = await createBankDeposit({
      bookId,
      date: "2026-09-14",
      bankAccountId: bankId,
      paymentIds,
    });
    expect(redeposit.total).toBe(50);

    // sanity: the void reversal entry exists and is sourced correctly
    const [entry] = await harness.db
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.id, voided.reversalEntryId));
    expect(entry?.sourceReferenceId).toBe(dep.depositId);
  });

  test("void rejects an already-voided deposit", async () => {
    const { bookId, bankId, paymentIds } = await seedUndepositedPayments(
      "org_dep_void2",
      [50],
    );
    const dep = await createBankDeposit({
      bookId,
      date: "2026-09-12",
      bankAccountId: bankId,
      paymentIds,
    });
    await voidBankDeposit(dep.depositId, bookId);
    await expect(voidBankDeposit(dep.depositId, bookId)).rejects.toThrow(
      /already void/i,
    );
  });
});
