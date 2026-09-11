import { describe, expect, test } from "bun:test";

import { getTableColumns } from "drizzle-orm";

import { quickbooksCutoverTable } from "lib/db/schema";

describe("quickbooks cutover schema", () => {
  test("quickbooksCutoverTable records a book cutover", () => {
    const columns = Object.keys(getTableColumns(quickbooksCutoverTable));

    expect(columns).toContain("bookId");
    expect(columns).toContain("connectedAccountId");
    expect(columns).toContain("reconciliationId");
    expect(columns).toContain("cutoverAt");
    expect(columns).toContain("createdAt");
  });
});
