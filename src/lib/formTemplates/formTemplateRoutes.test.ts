import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

// Only create/list are exercised here; they carry bookId and are guarded by the
// global middleware, so this file does not mock bookAccess.middleware (mocking
// it globally leaks into the middleware's own integration test)

const { default: formTemplateRoutes } = await import("./formTemplateRoutes");
const app = formTemplateRoutes;

describe("formTemplateRoutes", () => {
  beforeEach(() => resetDbMock());

  test("creates a template", async () => {
    setInsertReturningData([
      {
        id: "ft-1",
        bookId: "book-1",
        name: "Classic",
        documentType: "invoice",
      },
    ]);
    const res = await app.handle(
      new Request("http://localhost/api/form-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Classic",
          documentType: "invoice",
          accentColor: "#123456",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.template).toMatchObject({ name: "Classic" });
  });

  test("rejects an unknown document type", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/form-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Nope",
          documentType: "purchase-order",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  test("lists templates", async () => {
    setSelectResults([[{ id: "ft-1" }, { id: "ft-2" }]]);
    const res = await app.handle(
      new Request("http://localhost/api/form-templates?bookId=book-1"),
    );
    const data = await res.json();
    expect(data.templates).toHaveLength(2);
  });
});
