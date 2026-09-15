import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: generateArAging } = await import("./arAging");

beforeEach(() => {
  resetDbMock();
});

describe("generateArAging", () => {
  test("ages outstanding invoices by due date, grouped by customer", async () => {
    setSelectResults([
      [
        // not yet due -> current
        {
          total: "100",
          amountPaid: "0",
          dueDate: "2026-09-20",
          customerId: "c1",
          customerName: "Acme",
        },
        // 45 days overdue, partially paid -> days31to60 on the 150 balance
        {
          total: "200",
          amountPaid: "50",
          dueDate: "2026-08-01",
          customerId: "c1",
          customerName: "Acme",
        },
        // fully paid -> excluded
        {
          total: "50",
          amountPaid: "50",
          dueDate: "2026-08-01",
          customerId: "c2",
          customerName: "Beta",
        },
      ],
    ]);

    const report = await generateArAging({
      bookId: "book-1",
      asOfDate: "2026-09-15",
    });

    expect(report.customers).toHaveLength(1);
    const acme = report.customers[0];
    expect(acme).toMatchObject({
      customerName: "Acme",
      current: "100.0000",
      days31to60: "150.0000",
      total: "250.0000",
    });
    expect(report.totals.total).toBe("250.0000");
  });

  test("returns no customers when nothing is outstanding", async () => {
    setSelectResults([
      [
        {
          total: "100",
          amountPaid: "100",
          dueDate: "2026-08-01",
          customerId: "c1",
          customerName: "Acme",
        },
      ],
    ]);

    const report = await generateArAging({
      bookId: "book-1",
      asOfDate: "2026-09-15",
    });
    expect(report.customers).toHaveLength(0);
    expect(report.totals.total).toBe("0.0000");
  });
});
