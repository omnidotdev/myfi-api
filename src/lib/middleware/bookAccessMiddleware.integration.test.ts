import { beforeEach, describe, expect, mock, test } from "bun:test";

import { Elysia } from "elysia";

// Control what checkBookAccess sees: the access rows returned for a user/book
let accessRows: { role: string }[] = [];

mock.module("lib/db/db", () => ({
  dbPool: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(accessRows),
      }),
    }),
  },
}));

mock.module("lib/auth", () => ({
  extractBearerToken: (h: string | null) =>
    h?.startsWith("Bearer ") ? h.slice(7) : null,
  resolveUserFromToken: () => Promise.resolve({ id: "user-1" }),
}));

const { default: bookAccessMiddleware } = await import(
  "./bookAccess.middleware"
);

// Mount the middleware ahead of a protected route, mirroring server.ts, and
// exercise it over real requests — the unit test never mounts it, which is how
// the dead-scope bug slipped through
const app = new Elysia()
  .use(bookAccessMiddleware)
  .get("/api/thing", () => ({ ok: true }))
  .post("/api/thing", () => ({ ok: true }));

const call = (method: string, url: string) =>
  app.handle(
    new Request(`http://localhost${url}`, {
      method,
      headers: { authorization: "Bearer t" },
    }),
  );

describe("bookAccessMiddleware (mounted)", () => {
  beforeEach(() => {
    accessRows = [];
  });

  test("blocks a book the user has no access to (guard must run)", async () => {
    accessRows = [];
    const res = await call("GET", "/api/thing?bookId=b1");
    expect(res.status).toBe(403);
  });

  test("allows a book the user can view", async () => {
    accessRows = [{ role: "viewer" }];
    const res = await call("GET", "/api/thing?bookId=b1");
    expect(res.status).toBe(200);
  });

  test("a write requires more than viewer", async () => {
    accessRows = [{ role: "viewer" }];
    const res = await call("POST", "/api/thing?bookId=b1");
    expect(res.status).toBe(403);
  });

  test("a write is allowed for an editor", async () => {
    accessRows = [{ role: "editor" }];
    const res = await call("POST", "/api/thing?bookId=b1");
    expect(res.status).toBe(200);
  });

  test("a request with no bookId is not gated", async () => {
    const res = await call("GET", "/api/thing");
    expect(res.status).toBe(200);
  });
});
