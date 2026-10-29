import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  billLineTable,
  billTable,
  bookTable,
  purchaseOrderTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Purchase orders do not touch the ledger (like estimates), but conversion runs
// the real createBillDraft, so exercise create, convert, and status against real
// Postgres
let createPurchaseOrderDraft: typeof import("./createPurchaseOrderDraft").createPurchaseOrderDraft;
let convertPurchaseOrderToBill: typeof import("./convertPurchaseOrderToBill").convertPurchaseOrderToBill;
let updatePurchaseOrderStatus: typeof import("./updatePurchaseOrderStatus").updatePurchaseOrderStatus;
let harness: TestDb;

const acct = (
  bookId: string,
  name: string,
  type: "expense",
  subType: NonNullable<InsertAccount["subType"]>,
) =>
  harness.db
    .insert(accountTable)
    .values({ bookId, name, type, subType })
    .returning()
    .then((r) => r[0]!);

describe("purchase orders", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createPurchaseOrderDraft } = await import("./createPurchaseOrderDraft"));
    ({ convertPurchaseOrderToBill } = await import(
      "./convertPurchaseOrderToBill"
    ));
    ({ updatePurchaseOrderStatus } = await import(
      "./updatePurchaseOrderStatus"
    ));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seed = async (org: string) => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: org, name: "PO Co", type: "llc" })
      .returning();
    const bookId = book!.id;
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
    return { bookId, expenseId: expense.id, vendorId: vendor!.id };
  };

  test("creates an open purchase order with a computed subtotal and lines", async () => {
    const { bookId, expenseId, vendorId } = await seed("org_po1");

    const draft = await createPurchaseOrderDraft({
      bookId,
      vendorId,
      number: "PO-1",
      date: "2026-03-01",
      lines: [
        {
          description: "Phase 1",
          quantity: 1,
          unitPrice: 5000,
          expenseAccountId: expenseId,
        },
        {
          description: "Phase 2",
          quantity: 2,
          unitPrice: 1000,
          expenseAccountId: expenseId,
        },
      ],
    });

    expect(draft.subtotal).toBe(7000);
    expect(draft.lineCount).toBe(2);

    const [po] = await harness.db
      .select()
      .from(purchaseOrderTable)
      .where(eq(purchaseOrderTable.id, draft.purchaseOrderId));
    expect(po?.status).toBe("open");
    expect(po?.subtotal).toBe("7000.0000");
  });

  test("converts to a draft bill carrying the same lines and marks it converted", async () => {
    const { bookId, expenseId, vendorId } = await seed("org_po2");

    const draft = await createPurchaseOrderDraft({
      bookId,
      vendorId,
      number: "PO-2",
      date: "2026-03-01",
      lines: [
        {
          description: "Supplies",
          quantity: 2,
          unitPrice: 50,
          expenseAccountId: expenseId,
        },
      ],
    });

    const result = await convertPurchaseOrderToBill({
      purchaseOrderId: draft.purchaseOrderId,
      bookId,
      billNumber: "BILL-1",
      billDate: "2026-03-02",
      dueDate: "2026-04-01",
    });
    expect(result.alreadyConverted).toBe(false);

    // The bill is a draft with the purchase order's subtotal and expense account
    const [bill] = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.id, result.billId));
    expect(bill?.status).toBe("draft");
    expect(bill?.vendorId).toBe(vendorId);
    expect(bill?.subtotal).toBe("100.0000");

    const billLines = await harness.db
      .select()
      .from(billLineTable)
      .where(eq(billLineTable.billId, result.billId));
    expect(billLines).toHaveLength(1);
    expect(billLines[0]?.expenseAccountId).toBe(expenseId);
    expect(billLines[0]?.amount).toBe("100.0000");

    // The purchase order is now converted and records its bill
    const [po] = await harness.db
      .select()
      .from(purchaseOrderTable)
      .where(eq(purchaseOrderTable.id, draft.purchaseOrderId));
    expect(po?.status).toBe("converted");
    expect(po?.convertedBillId).toBe(result.billId);
  });

  test("re-converting is idempotent and does not create a second bill", async () => {
    const { bookId, expenseId, vendorId } = await seed("org_po3");

    const draft = await createPurchaseOrderDraft({
      bookId,
      vendorId,
      number: "PO-3",
      date: "2026-03-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 75,
          expenseAccountId: expenseId,
        },
      ],
    });

    const first = await convertPurchaseOrderToBill({
      purchaseOrderId: draft.purchaseOrderId,
      bookId,
      billNumber: "BILL-2",
      billDate: "2026-03-02",
      dueDate: "2026-04-01",
    });
    const second = await convertPurchaseOrderToBill({
      purchaseOrderId: draft.purchaseOrderId,
      bookId,
      billNumber: "BILL-2-DUP",
      billDate: "2026-03-02",
      dueDate: "2026-04-01",
    });

    expect(second.alreadyConverted).toBe(true);
    expect(second.billId).toBe(first.billId);

    // Exactly one bill exists for this vendor
    const bills = await harness.db
      .select()
      .from(billTable)
      .where(eq(billTable.vendorId, vendorId));
    expect(bills).toHaveLength(1);
  });

  test("refuses to convert a void purchase order", async () => {
    const { bookId, expenseId, vendorId } = await seed("org_po4");

    const draft = await createPurchaseOrderDraft({
      bookId,
      vendorId,
      number: "PO-4",
      date: "2026-03-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 25,
          expenseAccountId: expenseId,
        },
      ],
    });

    await updatePurchaseOrderStatus(draft.purchaseOrderId, bookId, "void");

    await expect(
      convertPurchaseOrderToBill({
        purchaseOrderId: draft.purchaseOrderId,
        bookId,
        billNumber: "BILL-3",
        billDate: "2026-03-02",
        dueDate: "2026-04-01",
      }),
    ).rejects.toThrow(/void/);
  });

  test("rejects a cross-book purchase order on convert (IDOR)", async () => {
    const { bookId, expenseId, vendorId } = await seed("org_po5");

    const draft = await createPurchaseOrderDraft({
      bookId,
      vendorId,
      number: "PO-5",
      date: "2026-03-01",
      lines: [
        {
          description: "Supplies",
          quantity: 1,
          unitPrice: 10,
          expenseAccountId: expenseId,
        },
      ],
    });

    await expect(
      convertPurchaseOrderToBill({
        purchaseOrderId: draft.purchaseOrderId,
        bookId: "other-book",
        billNumber: "BILL-4",
        billDate: "2026-03-02",
        dueDate: "2026-04-01",
      }),
    ).rejects.toThrow(/not found/);
  });
});
