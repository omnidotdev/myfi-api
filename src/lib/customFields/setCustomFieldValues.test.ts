import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { and, eq } from "drizzle-orm";

import {
  bookTable,
  customFieldDefinitionTable,
  customFieldValueTable,
} from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let setCustomFieldValues: typeof import("./setCustomFieldValues").setCustomFieldValues;
let harness: TestDb;

describe("setCustomFieldValues", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ setCustomFieldValues } = await import("./setCustomFieldValues"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "CF Co", type: "llc" })
      .returning();
    return book!.id;
  };

  const seedDef = (bookId: string, label: string) =>
    harness.db
      .insert(customFieldDefinitionTable)
      .values({ bookId, entityType: "customer", label })
      .returning()
      .then((r) => r[0]!);

  test("inserts then updates a value for an entity (upsert)", async () => {
    const bookId = await seedBook("org_cf_upsert");
    const def = await seedDef(bookId, "Account Rep");
    const entityId = crypto.randomUUID();

    await setCustomFieldValues({
      bookId,
      entityId,
      values: [{ definitionId: def.id, value: "Alice" }],
    });
    let [row] = await harness.db
      .select()
      .from(customFieldValueTable)
      .where(
        and(
          eq(customFieldValueTable.definitionId, def.id),
          eq(customFieldValueTable.entityId, entityId),
        ),
      );
    expect(row?.value).toBe("Alice");

    // writing again updates in place, not a second row
    await setCustomFieldValues({
      bookId,
      entityId,
      values: [{ definitionId: def.id, value: "Bob" }],
    });
    const rows = await harness.db
      .select()
      .from(customFieldValueTable)
      .where(
        and(
          eq(customFieldValueTable.definitionId, def.id),
          eq(customFieldValueTable.entityId, entityId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe("Bob");

    // an empty value clears it
    await setCustomFieldValues({
      bookId,
      entityId,
      values: [{ definitionId: def.id, value: "  " }],
    });
    [row] = await harness.db
      .select()
      .from(customFieldValueTable)
      .where(eq(customFieldValueTable.entityId, entityId));
    expect(row?.value).toBeNull();
  });

  test("rejects a definition from another book", async () => {
    const bookA = await seedBook("org_cf_a");
    const bookB = await seedBook("org_cf_b");
    const defB = await seedDef(bookB, "Foreign");
    await expect(
      setCustomFieldValues({
        bookId: bookA,
        entityId: crypto.randomUUID(),
        values: [{ definitionId: defB.id, value: "x" }],
      }),
    ).rejects.toThrow(/do not belong to this book/i);
  });
});
