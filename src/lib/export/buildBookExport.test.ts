import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import {
  accountTable,
  attachmentTable,
  bookTable,
  connectedAccountTable,
  customerTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

// The export reads every book-scoped table and must both include the book's own
// rows and exclude any other book's data, so exercise it against real migrated
// SQL rather than a mock
let buildBookExport: typeof import("./buildBookExport").buildBookExport;
let harness: TestDb;

// Distinctive sentinels planted in secret-bearing columns; none may appear in
// the serialized export
const SECRET_TAX_ID = "SENTINEL_TAX_ID_9999";
const SECRET_ACCESS_TOKEN = "SENTINEL_ACCESS_TOKEN_9999";
const SECRET_PROVIDER_ACCOUNT_ID = "SENTINEL_PLAID_ITEM_9999";
const SECRET_SYNC_CURSOR = "SENTINEL_SYNC_CURSOR_9999";
const SECRET_STORAGE_KEY = "SENTINEL_STORAGE_KEY_9999";

let ownBookId: string;

describe("buildBookExport", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ buildBookExport } = await import("./buildBookExport"));

    const { db } = harness;

    // The book under export
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_export", name: "Acme Co", type: "llc" })
      .returning();
    ownBookId = book.id;

    // A second, unrelated book whose data must never appear in the export
    const [otherBook] = await db
      .insert(bookTable)
      .values({ organizationId: "org_other", name: "Other LLC", type: "llc" })
      .returning();

    const [cash] = await db
      .insert(accountTable)
      .values({ bookId: book.id, name: "Cash", type: "asset" })
      .returning();
    const [revenue] = await db
      .insert(accountTable)
      .values({ bookId: book.id, name: "Sales", type: "revenue" })
      .returning();

    // Another book's account, to prove scoping
    await db
      .insert(accountTable)
      .values({ bookId: otherBook.id, name: "Other Cash", type: "asset" });

    const [entry] = await db
      .insert(journalEntryTable)
      .values({ bookId: book.id, date: "2026-06-01T00:00:00Z", memo: "Sale" })
      .returning();

    await db.insert(journalLineTable).values([
      {
        journalEntryId: entry.id,
        accountId: cash.id,
        debit: "100",
        credit: "0",
      },
      {
        journalEntryId: entry.id,
        accountId: revenue.id,
        debit: "0",
        credit: "100",
      },
    ]);

    const [customer] = await db
      .insert(customerTable)
      .values({ bookId: book.id, name: "Wile E" })
      .returning();

    await db.insert(invoiceTable).values({
      bookId: book.id,
      customerId: customer.id,
      number: "INV-1",
      issueDate: "2026-06-01",
      dueDate: "2026-06-30",
      total: "100",
    });

    // Secret-bearing rows: the raw values must be scrubbed from the export
    await db.insert(vendorTable).values({
      bookId: book.id,
      name: "Supplier",
      taxIdType: "ein",
      taxId: SECRET_TAX_ID,
    });

    await db.insert(connectedAccountTable).values({
      bookId: book.id,
      provider: "plaid",
      institutionName: "Some Bank",
      mask: "4321",
      accessToken: SECRET_ACCESS_TOKEN,
      providerAccountId: SECRET_PROVIDER_ACCOUNT_ID,
      syncCursor: SECRET_SYNC_CURSOR,
    });

    await db.insert(attachmentTable).values({
      bookId: book.id,
      filename: "receipt.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      storageKey: SECRET_STORAGE_KEY,
      createdBy: "user_1",
    });
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("returns null for a book that does not exist", async () => {
    const result = await buildBookExport(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });

  test("includes the book's own rows", async () => {
    const result = await buildBookExport(ownBookId);
    expect(result).not.toBeNull();
    const doc = result!;

    expect(doc.version).toBe(1);
    expect(typeof doc.exportedAt).toBe("string");
    expect(doc.book.name).toBe("Acme Co");

    expect(doc.accounts).toHaveLength(2);
    expect(doc.journalEntries).toHaveLength(1);
    expect(doc.journalLines).toHaveLength(2);
    expect(doc.customers).toHaveLength(1);
    expect(doc.invoices).toHaveLength(1);
    expect(doc.invoices[0]?.number).toBe("INV-1");
    expect(doc.vendors).toHaveLength(1);
    expect(doc.connectedAccounts).toHaveLength(1);
    expect(doc.attachments).toHaveLength(1);
  });

  test("does not include another book's data", async () => {
    const doc = (await buildBookExport(ownBookId))!;

    // Only this book's two accounts, never the other book's "Other Cash"
    expect(doc.accounts.every((a) => a.bookId === ownBookId)).toBe(true);
    expect(doc.accounts.some((a) => a.name === "Other Cash")).toBe(false);
  });

  test("contains no secret columns or values", async () => {
    const doc = (await buildBookExport(ownBookId))!;
    const serialized = JSON.stringify(doc);

    // No raw secret value leaks anywhere in the document
    for (const secret of [
      SECRET_TAX_ID,
      SECRET_ACCESS_TOKEN,
      SECRET_PROVIDER_ACCOUNT_ID,
      SECRET_SYNC_CURSOR,
      SECRET_STORAGE_KEY,
    ]) {
      expect(serialized).not.toContain(secret);
    }

    // Secret-bearing keys are absent from their table shapes
    const vendor = doc.vendors[0]!;
    expect("taxId" in vendor).toBe(false);
    expect(vendor.taxIdMasked).toBeDefined();

    const connected = doc.connectedAccounts[0]!;
    expect("accessToken" in connected).toBe(false);
    expect("providerAccountId" in connected).toBe(false);
    expect("syncCursor" in connected).toBe(false);
    // Non-sensitive descriptive columns are retained
    expect(connected.mask).toBe("4321");
    expect(connected.institutionName).toBe("Some Bank");

    const attachment = doc.attachments[0]!;
    expect("storageKey" in attachment).toBe(false);
    expect(attachment.filename).toBe("receipt.pdf");

    // The encrypted filer EIN is never emitted raw
    expect("ein" in doc.book).toBe(false);
  });
});
