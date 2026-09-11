import { describe, expect, test } from "bun:test";

import { getTableColumns } from "drizzle-orm";

import {
  quickbooksReconciliationLineTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";

describe("quickbooks reconciliation schema", () => {
  test("quickbooksReconciliationTable records a reconciliation run", () => {
    const columns = Object.keys(getTableColumns(quickbooksReconciliationTable));

    expect(columns).toContain("bookId");
    expect(columns).toContain("connectedAccountId");
    expect(columns).toContain("status");
    expect(columns).toContain("periodStart");
    expect(columns).toContain("periodEnd");
    expect(columns).toContain("totalVariance");
    expect(columns).toContain("mismatchCount");
  });

  test("quickbooksReconciliationLineTable records a per-account variance", () => {
    const columns = Object.keys(
      getTableColumns(quickbooksReconciliationLineTable),
    );

    expect(columns).toContain("reconciliationId");
    expect(columns).toContain("bookId");
    expect(columns).toContain("accountName");
    expect(columns).toContain("qboBalance");
    expect(columns).toContain("myfiBalance");
    expect(columns).toContain("variance");
  });
});
