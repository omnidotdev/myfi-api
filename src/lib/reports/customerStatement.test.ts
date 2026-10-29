import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { bookTable, customerTable, invoiceTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let generateCustomerStatement: typeof import("./customerStatement").default;
let harness: TestDb;

describe("generateCustomerStatement", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ default: generateCustomerStatement } = await import("./customerStatement"));
  });
  afterAll(async () => {
    await harness.client.close();
  });

  test("lists open invoice balances and nets available credit", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_stmt", name: "Stmt Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const [customer] = await db
      .insert(customerTable)
      .values({ bookId, name: "Buyer" })
      .returning();
    const base = {
      bookId,
      customerId: customer!.id,
      issueDate: "2026-02-01",
      dueDate: "2026-03-01",
    };
    await db.insert(invoiceTable).values([
      { ...base, number: "A", status: "open", total: "100.0000", amountPaid: "0.0000" },
      { ...base, number: "B", status: "partial", total: "300.0000", amountPaid: "100.0000" },
      // Paid invoice is excluded
      { ...base, number: "C", status: "paid", total: "50.0000", amountPaid: "50.0000" },
    ]);

    const stmt = await generateCustomerStatement({
      bookId,
      customerId: customer!.id,
      asOfDate: "2026-06-01",
    });
    // 100 (A) + 200 (B balance); C excluded
    expect(stmt.lines).toHaveLength(2);
    expect(stmt.totalOutstanding).toBe("300.0000");
    expect(stmt.balanceDue).toBe("300.0000");
  });
});
