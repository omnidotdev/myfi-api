import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  customerTable,
  invoiceLineTable,
  invoiceTable,
  recurringInvoiceTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { InsertAccount } from "lib/db/schema";
import type { TestDb } from "lib/test/realDb";

// Recurring invoices generate real draft rows on a schedule, so exercise the
// materializer against real Postgres: a due template creates exactly one draft
// per occurrence, advances its schedule, and never double-generates on a re-run
let createRecurringInvoice: typeof import("./recurringInvoiceService").createRecurringInvoice;
let materializeRecurringInvoices: typeof import("./materializeRecurringInvoices").materializeRecurringInvoices;
let harness: TestDb;

const seedAccount = (
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

interface Fixture {
  bookId: string;
  customerId: string;
  incomeAccountId: string;
}

const seedBook = async (org: string): Promise<Fixture> => {
  const { db } = harness;
  const [book] = await db
    .insert(bookTable)
    .values({ organizationId: org, name: "RI Co", type: "llc" })
    .returning();
  const bookId = book!.id;
  const income = await seedAccount(bookId, "Sales", "revenue", "sales");
  const [customer] = await db
    .insert(customerTable)
    .values({ bookId, name: "Buyer" })
    .returning();
  return { bookId, customerId: customer!.id, incomeAccountId: income.id };
};

const invoicesFor = (bookId: string) =>
  harness.db.select().from(invoiceTable).where(eq(invoiceTable.bookId, bookId));

describe("materializeRecurringInvoices", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createRecurringInvoice } = await import("./recurringInvoiceService"));
    ({ materializeRecurringInvoices } = await import(
      "./materializeRecurringInvoices"
    ));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("generates one draft for a due monthly template and advances the schedule", async () => {
    const fx = await seedBook("org_monthly");
    const { template } = await createRecurringInvoice({
      bookId: fx.bookId,
      customerId: fx.customerId,
      numberPrefix: "REC-",
      frequency: "monthly",
      nextRunDate: "2026-01-01",
      dueInDays: 30,
      lines: [
        {
          description: "Monthly retainer",
          quantity: 2,
          unitPrice: 50,
          incomeAccountId: fx.incomeAccountId,
        },
      ],
    });

    const result = await materializeRecurringInvoices({
      bookId: fx.bookId,
      asOf: "2026-01-15",
    });
    expect(result.generated).toBe(1);

    const invoices = await invoicesFor(fx.bookId);
    expect(invoices).toHaveLength(1);
    const invoice = invoices[0]!;
    expect(invoice.status).toBe("draft");
    expect(invoice.issueDate).toBe("2026-01-01");
    // dueDate is issueDate + dueInDays (30 days after 2026-01-01)
    expect(invoice.dueDate).toBe("2026-01-31");
    expect(invoice.customerId).toBe(fx.customerId);
    expect(invoice.number).toBe("REC-2026-01-01");
    // 2 x 50 = 100 pre-tax subtotal carried from the template line
    expect(invoice.subtotal).toBe("100.0000");

    const lines = await harness.db
      .select()
      .from(invoiceLineTable)
      .where(eq(invoiceLineTable.invoiceId, invoice.id));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.description).toBe("Monthly retainer");
    expect(lines[0]!.incomeAccountId).toBe(fx.incomeAccountId);

    // schedule advanced one month past the generated occurrence
    const [after] = await harness.db
      .select()
      .from(recurringInvoiceTable)
      .where(eq(recurringInvoiceTable.id, template.id));
    expect(after!.nextRunDate).toBe("2026-02-01");
  });

  test("is idempotent: a second run as of the same date generates nothing", async () => {
    const fx = await seedBook("org_idem");
    await createRecurringInvoice({
      bookId: fx.bookId,
      customerId: fx.customerId,
      frequency: "monthly",
      nextRunDate: "2026-01-01",
      lines: [
        {
          description: "Service",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: fx.incomeAccountId,
        },
      ],
    });

    const first = await materializeRecurringInvoices({
      bookId: fx.bookId,
      asOf: "2026-01-15",
    });
    expect(first.generated).toBe(1);

    const second = await materializeRecurringInvoices({
      bookId: fx.bookId,
      asOf: "2026-01-15",
    });
    expect(second.generated).toBe(0);

    const invoices = await invoicesFor(fx.bookId);
    expect(invoices).toHaveLength(1);
  });

  test("an inactive template generates nothing", async () => {
    const fx = await seedBook("org_inactive");
    const { template } = await createRecurringInvoice({
      bookId: fx.bookId,
      customerId: fx.customerId,
      frequency: "monthly",
      nextRunDate: "2026-01-01",
      lines: [
        {
          description: "Service",
          quantity: 1,
          unitPrice: 100,
          incomeAccountId: fx.incomeAccountId,
        },
      ],
    });
    await harness.db
      .update(recurringInvoiceTable)
      .set({ isActive: false })
      .where(eq(recurringInvoiceTable.id, template.id));

    const result = await materializeRecurringInvoices({
      bookId: fx.bookId,
      asOf: "2026-06-30",
    });
    expect(result.generated).toBe(0);

    const invoices = await invoicesFor(fx.bookId);
    expect(invoices).toHaveLength(0);

    // an inactive template is left untouched, so its schedule does not advance
    const [after] = await harness.db
      .select()
      .from(recurringInvoiceTable)
      .where(eq(recurringInvoiceTable.id, template.id));
    expect(after!.nextRunDate).toBe("2026-01-01");
  });

  test("catches up missed occurrences across a span", async () => {
    const fx = await seedBook("org_catchup");
    const { template } = await createRecurringInvoice({
      bookId: fx.bookId,
      customerId: fx.customerId,
      frequency: "monthly",
      nextRunDate: "2026-01-01",
      lines: [
        {
          description: "Service",
          quantity: 1,
          unitPrice: 10,
          incomeAccountId: fx.incomeAccountId,
        },
      ],
    });

    // Jan, Feb, Mar are all due as of mid-March
    const result = await materializeRecurringInvoices({
      bookId: fx.bookId,
      asOf: "2026-03-15",
    });
    expect(result.generated).toBe(3);

    const invoices = await invoicesFor(fx.bookId);
    expect(invoices.map((i) => i.issueDate).sort()).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);

    const [after] = await harness.db
      .select()
      .from(recurringInvoiceTable)
      .where(eq(recurringInvoiceTable.id, template.id));
    expect(after!.nextRunDate).toBe("2026-04-01");
  });
});
