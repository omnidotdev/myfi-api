import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import {
  accountTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  journalLineTrackingCategoryTable,
  trackingCategoryTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

// A tracking-category (class/location) filter on the P&L must count only the
// journal lines carrying that category, so exercise it against real Postgres
let generateProfitAndLoss: typeof import("./profitAndLoss").default;
let harness: TestDb;

describe("profitAndLoss tracking-category filter", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ default: generateProfitAndLoss } = await import("./profitAndLoss"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("includes only revenue tagged with the given tracking category", async () => {
    const { db } = harness;
    const [book] = await db
      .insert(bookTable)
      .values({ organizationId: "org_tc", name: "TC Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const [sales] = await db
      .insert(accountTable)
      .values({ bookId, name: "Sales", type: "revenue", subType: "sales" })
      .returning();
    const [east] = await db
      .insert(trackingCategoryTable)
      .values({ bookId, kind: "location", name: "East" })
      .returning();

    // Two revenue entries: one credited 100 tagged East, one credited 40 untagged
    const [entry] = await db
      .insert(journalEntryTable)
      .values({
        bookId,
        date: "2026-03-01",
        memo: "East sale",
        source: "manual",
      })
      .returning();
    const [tagged] = await db
      .insert(journalLineTable)
      .values({
        journalEntryId: entry!.id,
        accountId: sales!.id,
        debit: "0.0000",
        credit: "100.0000",
      })
      .returning();
    await db.insert(journalLineTrackingCategoryTable).values({
      journalLineId: tagged!.id,
      trackingCategoryId: east!.id,
    });

    const [entry2] = await db
      .insert(journalEntryTable)
      .values({ bookId, date: "2026-03-02", memo: "Other", source: "manual" })
      .returning();
    await db.insert(journalLineTable).values({
      journalEntryId: entry2!.id,
      accountId: sales!.id,
      debit: "0.0000",
      credit: "40.0000",
    });

    const unfiltered = await generateProfitAndLoss({
      bookId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(unfiltered.totalRevenue).toBe("140.0000");

    const filtered = await generateProfitAndLoss({
      bookId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      trackingCategoryIds: [east!.id],
    });
    expect(filtered.totalRevenue).toBe("100.0000");
  });
});
