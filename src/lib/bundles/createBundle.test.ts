import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  accountTable,
  bookTable,
  bundleComponentTable,
  inventoryItemTable,
  itemBundleTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let createBundle: typeof import("./createBundle").createBundle;
let harness: TestDb;

describe("createBundle", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ createBundle } = await import("./createBundle"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "Bundle Co", type: "llc" })
      .returning();
    const bookId = book!.id;
    const [income] = await harness.db
      .insert(accountTable)
      .values({ bookId, name: "Sales", type: "revenue", subType: "sales" })
      .returning();
    return { bookId, incomeId: income!.id };
  };

  const seedItem = (bookId: string, incomeId: string, name: string) =>
    harness.db
      .insert(inventoryItemTable)
      .values({
        bookId,
        name,
        itemType: "service",
        salePrice: "50.0000",
        incomeAccountId: incomeId,
      })
      .returning()
      .then((r) => r[0]!);

  test("creates a bundle with components", async () => {
    const { bookId, incomeId } = await seedBook("org_bundle");
    const a = await seedItem(bookId, incomeId, "Setup");
    const b = await seedItem(bookId, incomeId, "Training");

    const result = await createBundle({
      bookId,
      name: "Onboarding",
      components: [
        { inventoryItemId: a.id, quantity: 1 },
        { inventoryItemId: b.id, quantity: 2 },
      ],
    });

    expect(result.componentCount).toBe(2);
    const [bundle] = await harness.db
      .select()
      .from(itemBundleTable)
      .where(eq(itemBundleTable.id, result.bundleId));
    expect(bundle?.name).toBe("Onboarding");

    const components = await harness.db
      .select()
      .from(bundleComponentTable)
      .where(eq(bundleComponentTable.bundleId, result.bundleId));
    expect(components).toHaveLength(2);
  });

  test("rejects a component item from another book", async () => {
    const a = await seedBook("org_bundle_a");
    const b = await seedBook("org_bundle_b");
    const foreignItem = await seedItem(b.bookId, b.incomeId, "Foreign");
    await expect(
      createBundle({
        bookId: a.bookId,
        name: "Bad",
        components: [{ inventoryItemId: foreignItem.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/do not belong to this book/i);
  });

  test("rejects an empty bundle", async () => {
    const { bookId } = await seedBook("org_bundle_empty");
    await expect(
      createBundle({ bookId, name: "Empty", components: [] }),
    ).rejects.toThrow(/at least one component/i);
  });
});
