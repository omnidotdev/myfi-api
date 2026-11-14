import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { lookupBookAiScope } = await import("./bookAiScope");

const ORG_ID = "0b6f2a3e-5c1d-4e8f-9a7b-1c2d3e4f5a6b";
const OWNER_ID = "7e1d2c3b-4a59-4687-8796-a5b4c3d2e1f0";
const ACTOR_ID = "3f2e1d0c-9b8a-4796-a5b4-c3d2e1f0a9b8";

describe("lookupBookAiScope", () => {
  beforeEach(() => {
    resetDbMock();
  });

  test("bills the book's organization and mints under the acting user", async () => {
    setSelectResults([[{ organizationId: ORG_ID }]]);

    const scope = await lookupBookAiScope("book-1", ACTOR_ID);

    expect(scope).toEqual({ keyHolderId: ACTOR_ID, organizationId: ORG_ID });
    // No owner lookup when an actor is present
    expect(mockDbPool.select).toHaveBeenCalledTimes(1);
  });

  test("background work mints under the book's owner", async () => {
    setSelectResults([[{ organizationId: ORG_ID }], [{ userId: OWNER_ID }]]);

    const scope = await lookupBookAiScope("book-1");

    expect(scope).toEqual({ keyHolderId: OWNER_ID, organizationId: ORG_ID });
  });

  test("an unknown book has no scope", async () => {
    setSelectResults([[]]);

    expect(await lookupBookAiScope("missing")).toBeNull();
  });

  test("a book with no owner has no scope for background work", async () => {
    setSelectResults([[{ organizationId: ORG_ID }], []]);

    expect(await lookupBookAiScope("book-1")).toBeNull();
  });
});
