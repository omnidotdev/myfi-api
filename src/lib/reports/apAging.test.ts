import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { billTable, bookTable, vendorTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

// AP aging reads the bill subledger, so exercise the real query against PGlite
// rather than the hand-rolled mock, which cannot enforce the status filter or
// the outstanding-balance math
let generateApAging: typeof import("./apAging").default;
let harness: TestDb;

const AS_OF = "2026-06-01";

describe("generateApAging", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({ dbPool: harness.db, pgPool: harness.client }));
    ({ default: generateApAging } = await import("./apAging"));

    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_ap", name: "AP Co", type: "llc" })
      .returning();
    const [acme] = await db
      .insert(vendorTable)
      .values({ bookId: book.id, name: "Acme Supplies" })
      .returning();
    const [globex] = await db
      .insert(vendorTable)
      .values({ bookId: book.id, name: "Globex" })
      .returning();

    await db.insert(billTable).values([
      // Acme: not yet due (current), fully unpaid
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-1",
        status: "open",
        billDate: "2026-05-20",
        dueDate: "2026-06-15",
        total: "100.0000",
        amountPaid: "0",
      },
      // Acme: 10 days overdue (1-30), partially paid -> outstanding 200
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-2",
        status: "partial",
        billDate: "2026-05-01",
        dueDate: "2026-05-22",
        total: "300.0000",
        amountPaid: "100.0000",
      },
      // Acme: 45 days overdue (31-60), partially paid -> outstanding 150
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-3",
        status: "partial",
        billDate: "2026-04-01",
        dueDate: "2026-04-17",
        total: "200.0000",
        amountPaid: "50.0000",
      },
      // Globex: 120 days overdue (over 90)
      {
        bookId: book.id,
        vendorId: globex.id,
        number: "G-1",
        status: "open",
        billDate: "2026-01-15",
        dueDate: "2026-02-01",
        total: "500.0000",
        amountPaid: "0",
      },
      // Excluded: paid, void, and draft bills never age
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-PAID",
        status: "paid",
        billDate: "2026-05-01",
        dueDate: "2026-05-12",
        total: "999.0000",
        amountPaid: "999.0000",
      },
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-VOID",
        status: "void",
        billDate: "2026-05-01",
        dueDate: "2026-05-12",
        total: "777.0000",
        amountPaid: "0",
      },
      {
        bookId: book.id,
        vendorId: acme.id,
        number: "A-DRAFT",
        status: "draft",
        billDate: "2026-05-01",
        dueDate: "2026-05-12",
        total: "555.0000",
        amountPaid: "0",
      },
    ]);
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("ages open and partial bills by due date, grouped by vendor", async () => {
    const [book] = await harness.db.select().from(bookTable);
    const report = await generateApAging({
      bookId: book!.id,
      asOfDate: AS_OF,
    });

    expect(report.reportType).toBe("ap");
    const acme = report.vendors.find((v) => v.vendorName === "Acme Supplies");
    expect(acme).toBeDefined();
    expect(acme?.current).toBe("100.0000");
    expect(acme?.days1to30).toBe("200.0000");
    expect(acme?.days31to60).toBe("150.0000");
    expect(acme?.days61to90).toBe("0.0000");
    expect(acme?.over90).toBe("0.0000");
    expect(acme?.total).toBe("450.0000");

    const globex = report.vendors.find((v) => v.vendorName === "Globex");
    expect(globex?.over90).toBe("500.0000");
    expect(globex?.total).toBe("500.0000");
  });

  test("excludes paid, void, and draft bills and totals the outstanding balance", async () => {
    const [book] = await harness.db.select().from(bookTable);
    const report = await generateApAging({
      bookId: book!.id,
      asOfDate: AS_OF,
    });

    // 100 + 200 + 150 (Acme) + 500 (Globex); the paid/void/draft bills are gone
    expect(report.totals.total).toBe("950.0000");
    expect(report.vendors).toHaveLength(2);
  });
});
