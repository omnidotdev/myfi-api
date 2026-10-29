import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));
mock.module("lib/middleware/bookAccess.middleware", () => ({
  authorizeBook: mock(async () => ({ userId: "user-1" })),
}));

const { default: customFieldRoutes } = await import("./customFieldRoutes");
const app = customFieldRoutes;

const post = (path: string, body: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("customFieldRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a definition", async () => {
    setInsertReturningData([
      { id: "d-1", bookId: "book-1", entityType: "customer", label: "Rep" },
    ]);
    const res = await post("/api/custom-fields/definitions", {
      bookId: "book-1",
      entityType: "customer",
      label: "Rep",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.definition).toMatchObject({
      entityType: "customer",
      label: "Rep",
    });
  });

  test("rejects an unknown entity type", async () => {
    const res = await post("/api/custom-fields/definitions", {
      bookId: "book-1",
      entityType: "spaceship",
      label: "Nope",
    });
    expect(res.status).toBe(400);
  });

  test("rejects an unknown field type", async () => {
    const res = await post("/api/custom-fields/definitions", {
      bookId: "book-1",
      entityType: "invoice",
      label: "Weird",
      fieldType: "rainbow",
    });
    expect(res.status).toBe(400);
  });

  test("lists definitions for a book", async () => {
    setSelectResults([
      [
        { id: "d-1", entityType: "customer", label: "Rep", position: 0 },
        { id: "d-2", entityType: "customer", label: "Tier", position: 1 },
      ],
    ]);
    const res = await app.handle(
      new Request(
        "http://localhost/api/custom-fields/definitions?bookId=book-1&entityType=customer",
      ),
    );
    const data = await res.json();
    expect(data.definitions).toHaveLength(2);
  });
});
