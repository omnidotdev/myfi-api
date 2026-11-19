import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import {
  accountTable,
  attachmentTable,
  bookTable,
  connectedAccountTable,
  documentTable,
  payrollConnectionTable,
} from "lib/db/schema";
import { createIdpWebhook } from "lib/idp/idpWebhook";
import { createTestDb } from "lib/test/realDb";

import type { TestDb } from "lib/test/realDb";

// Workspace deletion removes real financial records and reaches Plaid, Gusto,
// and object storage, so run it against real Postgres with the providers faked
let harness: TestDb;

const SECRET = "test-idp-secret";
const ORG = "org-deleted";
const OTHER_ORG = "org-kept";

const calls = {
  plaid: [] as string[],
  gusto: [] as string[],
  files: [] as string[],
};
let failStorage = false;

const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("hex");

const app = (webhookSecret = SECRET) =>
  createIdpWebhook({
    webhookSecret,
    // biome-ignore lint/suspicious/noExplicitAny: PGlite drizzle client stands in for the pool
    db: harness.db as any,
    revokePlaid: async (token) => {
      calls.plaid.push(token);
      return true;
    },
    revokeGusto: async (token) => {
      calls.gusto.push(token);
      return true;
    },
    deleteStoredObject: async (key) => {
      if (failStorage) throw new Error("storage unavailable");
      calls.files.push(key);
    },
    storageConfigured: () => true,
  });

const post = (
  body: unknown,
  {
    signature,
    secret,
    mount = (plugin) => plugin,
  }: {
    signature?: string | null;
    secret?: string;
    mount?: (plugin: ReturnType<typeof app>) => {
      handle: (r: Request) => Promise<Response>;
    };
  } = {},
) => {
  const raw = JSON.stringify(body);
  return mount(app(secret)).handle(
    new Request("http://localhost/webhooks/idp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature === null
          ? {}
          : { "x-idp-signature": signature ?? sign(raw) }),
      },
      body: raw,
    }),
  );
};

// The flat shape Vortex delivers (IDP_EVENT_TRANSFORM)
const deleted = (organizationId: string) => ({
  eventType: "organization.deleted",
  organizationId,
  timestamp: new Date().toISOString(),
});

/** A book holding an account, two bank accounts on one Plaid item, payroll, and files */
const seedBook = async (organizationId: string) => {
  const { db } = harness;
  const [book] = await db
    .insert(bookTable)
    .values({ organizationId, name: organizationId, type: "llc" })
    .returning();
  if (!book) throw new Error("book not seeded");

  await db
    .insert(accountTable)
    .values({ bookId: book.id, name: "Checking", type: "asset" });
  await db.insert(connectedAccountTable).values([
    { bookId: book.id, provider: "plaid", accessToken: `plaid-${book.id}` },
    { bookId: book.id, provider: "plaid", accessToken: `plaid-${book.id}` },
  ]);
  await db.insert(payrollConnectionTable).values({
    bookId: book.id,
    provider: "gusto",
    accessToken: `gusto-${book.id}`,
  });
  const file = {
    contentType: "application/pdf",
    sizeBytes: 10,
    createdBy: "user-1",
  };
  await db.insert(attachmentTable).values({
    ...file,
    bookId: book.id,
    filename: "receipt.pdf",
    storageKey: `attachments/${book.id}/receipt.pdf`,
  });
  await db.insert(documentTable).values({
    ...file,
    bookId: book.id,
    name: "W-9",
    filename: "w9.pdf",
    storageKey: `documents/${book.id}/w9.pdf`,
  });
  return book.id;
};

const rowsFor = async (bookId: string) => {
  const { db } = harness;
  return {
    books: (await db.select().from(bookTable).where(eq(bookTable.id, bookId)))
      .length,
    accounts: (
      await db
        .select()
        .from(accountTable)
        .where(eq(accountTable.bookId, bookId))
    ).length,
    connections: (
      await db
        .select()
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.bookId, bookId))
    ).length,
    files: (
      await db
        .select()
        .from(attachmentTable)
        .where(eq(attachmentTable.bookId, bookId))
    ).length,
  };
};

describe("POST /webhooks/idp organization.deleted", () => {
  beforeAll(async () => {
    harness = await createTestDb();
  });

  afterAll(async () => {
    await harness.client.close();
  });

  beforeEach(async () => {
    await harness.db.delete(bookTable);
    calls.plaid.length = 0;
    calls.gusto.length = 0;
    calls.files.length = 0;
    failStorage = false;
  });

  test("deletes the workspace's books after revoking their connections and deleting their files", async () => {
    const bookId = await seedBook(ORG);

    const res = await post(deleted(ORG));
    expect(res.status).toBe(200);

    expect(await rowsFor(bookId)).toEqual({
      books: 0,
      accounts: 0,
      connections: 0,
      files: 0,
    });
    // Two bank accounts on one Plaid item: the item is removed once
    expect(calls.plaid).toEqual([`plaid-${bookId}`]);
    expect(calls.gusto).toEqual([`gusto-${bookId}`]);
    expect(calls.files.sort()).toEqual([
      `attachments/${bookId}/receipt.pdf`,
      `documents/${bookId}/w9.pdf`,
    ]);
  });

  test("leaves another workspace's books and connections untouched", async () => {
    await seedBook(ORG);
    const kept = await seedBook(OTHER_ORG);

    await post(deleted(ORG));

    expect(await rowsFor(kept)).toEqual({
      books: 1,
      accounts: 1,
      connections: 2,
      files: 1,
    });
    expect(calls.plaid).not.toContain(`plaid-${kept}`);
  });

  test("is idempotent: a redelivery, or a workspace without books, acks 200", async () => {
    await seedBook(ORG);
    expect((await post(deleted(ORG))).status).toBe(200);
    expect((await post(deleted(ORG))).status).toBe(200);
    expect(calls.plaid).toHaveLength(1);
  });

  test("keeps the books when a stored file cannot be deleted, so the retry finds it", async () => {
    const bookId = await seedBook(ORG);
    failStorage = true;

    expect((await post(deleted(ORG))).status).toBe(500);
    expect((await rowsFor(bookId)).books).toBe(1);
  });

  test("refuses an unsigned or forged call (401) and deletes nothing", async () => {
    const bookId = await seedBook(ORG);
    expect((await post(deleted(ORG), { signature: null })).status).toBe(401);
    expect((await post(deleted(ORG), { signature: "deadbeef" })).status).toBe(
      401,
    );
    expect((await rowsFor(bookId)).books).toBe(1);
    expect(calls.plaid).toHaveLength(0);
  });

  test("fails closed (503) when no secret is configured", async () => {
    const bookId = await seedBook(ORG);
    expect((await post(deleted(ORG), { secret: "" })).status).toBe(503);
    expect((await rowsFor(bookId)).books).toBe(1);
  });

  test("still reads the signed body when a global hook has already parsed it", async () => {
    // The server's book-access middleware reads every request's body in a
    // global hook, which consumes the stream before this route runs
    const bookId = await seedBook(ORG);
    const res = await post(deleted(ORG), {
      mount: (plugin) =>
        new Elysia()
          .onBeforeHandle({ as: "global" }, ({ body }) => {
            void body;
          })
          .use(plugin),
    });

    expect(res.status).toBe(200);
    expect((await rowsFor(bookId)).books).toBe(0);
  });

  test("rejects an event without an organization id (400)", async () => {
    expect((await post({ eventType: "organization.deleted" })).status).toBe(
      400,
    );
  });
});
