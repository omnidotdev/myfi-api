import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { bookAccessTable, bookTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

// Workspace data deletion removes real financial records, so exercise the
// owner-scoped purge against real Postgres: it must delete only the caller's
// own books in the named organization and nothing else
let purgeOwnedBooksInOrg: typeof import("./purgeOwnedBooksInOrg").purgeOwnedBooksInOrg;
let harness: TestDb;

const makeBook = (organizationId: string, name: string) =>
  harness.db
    .insert(bookTable)
    .values({ organizationId, name, type: "llc" })
    .returning()
    .then((r) => r[0]!);

const grant = (userId: string, bookId: string, role: string) =>
  harness.db.insert(bookAccessTable).values({ userId, bookId, role });

describe("purgeOwnedBooksInOrg", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ purgeOwnedBooksInOrg } = await import("./purgeOwnedBooksInOrg"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  test("deletes only the caller's owned books in the given organization", async () => {
    const { db } = harness;
    const owned = await makeBook("org-1", "Owned");
    const viewerOnly = await makeBook("org-1", "ViewerOnly");
    const otherOrg = await makeBook("org-2", "OtherOrg");
    await grant("user-1", owned.id, "owner");
    await grant("user-1", viewerOnly.id, "viewer");
    await grant("user-1", otherOrg.id, "owner");

    const result = await purgeOwnedBooksInOrg("user-1", "org-1");

    expect(result.deletedBookIds).toEqual([owned.id]);
    expect(result.skippedBookIds).toEqual([viewerOnly.id]);

    const remaining = await db
      .select({ id: bookTable.id })
      .from(bookTable)
      .where(eq(bookTable.organizationId, "org-1"));
    // The viewer-only book survives; the owned one is gone
    expect(remaining.map((b) => b.id)).toEqual([viewerOnly.id]);

    // A book in another organization is never touched
    const other = await db
      .select({ id: bookTable.id })
      .from(bookTable)
      .where(eq(bookTable.organizationId, "org-2"));
    expect(other.map((b) => b.id)).toEqual([otherOrg.id]);
  });
});
