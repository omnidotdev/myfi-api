import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { bookTable, formTemplateTable } from "lib/db/schema";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

let setDefaultFormTemplate: typeof import("./setDefaultFormTemplate").setDefaultFormTemplate;
let harness: TestDb;

describe("setDefaultFormTemplate", () => {
  beforeAll(async () => {
    harness = await createTestDb();
    mock.module("lib/db/db", () => ({
      dbPool: harness.db,
      pgPool: harness.client,
    }));
    ({ setDefaultFormTemplate } = await import("./setDefaultFormTemplate"));
  });

  afterAll(async () => {
    await harness.client.close();
  });

  const seedBook = async (organizationId: string) => {
    const [book] = await harness.db
      .insert(bookTable)
      .values({ organizationId, name: "FT Co", type: "llc" })
      .returning();
    return book!.id;
  };

  const addTemplate = (bookId: string, name: string, isDefault = false) =>
    harness.db
      .insert(formTemplateTable)
      .values({ bookId, name, documentType: "invoice", isDefault })
      .returning()
      .then((r) => r[0]!);

  test("makes one default and clears the others of the same type", async () => {
    const bookId = await seedBook("org_ft");
    const a = await addTemplate(bookId, "Classic", true);
    const b = await addTemplate(bookId, "Modern");

    await setDefaultFormTemplate(bookId, b.id);

    const rows = await harness.db
      .select()
      .from(formTemplateTable)
      .where(eq(formTemplateTable.bookId, bookId));
    const byId = (id: string) => rows.find((r) => r.id === id);
    expect(byId(a.id)?.isDefault).toBe(false);
    expect(byId(b.id)?.isDefault).toBe(true);
  });

  test("rejects a template from another book", async () => {
    const bookA = await seedBook("org_ft_a");
    const bookB = await seedBook("org_ft_b");
    const tplB = await addTemplate(bookB, "Foreign");
    await expect(setDefaultFormTemplate(bookA, tplB.id)).rejects.toThrow(
      /not found/i,
    );
  });
});
