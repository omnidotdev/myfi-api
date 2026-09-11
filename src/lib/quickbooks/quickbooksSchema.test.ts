import { describe, expect, test } from "bun:test";

import { getTableColumns } from "drizzle-orm";

import {
  connectedAccountTable,
  quickbooksAccountMapTable,
  quickbooksMigrationTable,
} from "lib/db/schema";

describe("quickbooks schema", () => {
  test("connectedAccountTable has QuickBooks connection columns", () => {
    const columns = Object.keys(getTableColumns(connectedAccountTable));

    expect(columns).toContain("refreshToken");
    expect(columns).toContain("realmId");
  });

  test("quickbooksAccountMapTable maps a QBO account to a MyFi account", () => {
    const columns = Object.keys(getTableColumns(quickbooksAccountMapTable));

    expect(columns).toContain("bookId");
    expect(columns).toContain("qboAccountId");
    expect(columns).toContain("myfiAccountId");
  });

  test("quickbooksMigrationTable records a backfill run", () => {
    const columns = Object.keys(getTableColumns(quickbooksMigrationTable));

    expect(columns).toContain("bookId");
    expect(columns).toContain("connectedAccountId");
    expect(columns).toContain("status");
    expect(columns).toContain("entriesImported");
  });
});
