import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

describe("real-postgres test harness (PGlite)", () => {
  let db: TestDb["db"];
  let client: TestDb["client"];

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  test("applies the full migration set to a real Postgres schema", async () => {
    // information_schema is only populated if the DDL actually executed, so this
    // proves migrations ran against a real engine rather than a stub
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = result.rows.map((row) => row.table_name);
    expect(names).toContain("book");
    expect(names).toContain("account");
    expect(names).toContain("journal_entry");
    expect(names).toContain("journal_line");
    expect(names).toContain("invoice");
  });

  test("a balanced journal entry persists and sums debits equal to credits", async () => {
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_test", name: "Test Co", type: "llc" })
      .returning();
    const [ar] = await db
      .insert(accountTable)
      .values({
        bookId: book.id,
        name: "Accounts Receivable",
        type: "asset",
        subType: "accounts_receivable",
      })
      .returning();
    const [sales] = await db
      .insert(accountTable)
      .values({ bookId: book.id, name: "Sales", type: "revenue", subType: "sales" })
      .returning();
    const [entry] = await db
      .insert(journalEntryTable)
      .values({ bookId: book.id, date: "2026-01-01T00:00:00.000Z" })
      .returning();
    await db.insert(journalLineTable).values([
      { journalEntryId: entry.id, accountId: ar.id, debit: "100.0000", credit: "0" },
      { journalEntryId: entry.id, accountId: sales.id, debit: "0", credit: "100.0000" },
    ]);

    const totals = await db.execute<{ total_debit: string; total_credit: string }>(
      sql`select sum(debit) as total_debit, sum(credit) as total_credit from journal_line`,
    );
    expect(Number(totals.rows[0]?.total_debit)).toBe(100);
    expect(Number(totals.rows[0]?.total_credit)).toBe(100);
  });

  test("live foreign-key constraints reject rows the mock would have accepted", async () => {
    // A journal line pointing at a nonexistent entry and account must throw. The
    // hand-rolled mock accepts anything, so this invariant was previously untested
    // Promise.resolve adopts drizzle's thenable builder into a real Promise so
    // bun's .rejects matcher accepts it
    await expect(
      Promise.resolve(
        db.insert(journalLineTable).values({
          journalEntryId: crypto.randomUUID(),
          accountId: crypto.randomUUID(),
          debit: "1",
          credit: "0",
        }),
      ),
    ).rejects.toThrow();
  });

  test("the unique source-reference index blocks duplicate external entries", async () => {
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_idem", name: "Idem Co", type: "llc" })
      .returning();
    const dupe = {
      bookId: book.id,
      date: "2026-02-01T00:00:00.000Z",
      source: "mantle_sync",
      sourceReferenceId: "evt_1",
    };
    await db.insert(journalEntryTable).values(dupe);
    await expect(
      Promise.resolve(db.insert(journalEntryTable).values(dupe)),
    ).rejects.toThrow();
  });
});
