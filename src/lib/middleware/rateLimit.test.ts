import { describe, expect, test } from "bun:test";

import { createRateLimiter, rateLimit } from "./rateLimit";

describe("createRateLimiter", () => {
  test("allows requests up to the max within a window", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });

    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
  });

  test("reports remaining budget", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });

    expect(limiter.check("k").remaining).toBe(1);
    expect(limiter.check("k").remaining).toBe(0);
    expect(limiter.check("k").remaining).toBe(0);
  });

  test("buckets keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  test("resets after the window elapses", () => {
    let t = 1000;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });

    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);

    t += 1000; // window boundary reached
    expect(limiter.check("k").allowed).toBe(true);
  });

  test("computes retry-after as whole seconds left in the window", () => {
    let t = 0;
    const limiter = createRateLimiter({
      windowMs: 10_000,
      max: 1,
      now: () => t,
    });

    expect(limiter.check("k").retryAfterSeconds).toBe(0); // allowed
    t = 2500;
    // 7.5s left in the window, rounded up
    expect(limiter.check("k").retryAfterSeconds).toBe(8);
  });
});

describe("rateLimit (Elysia hook)", () => {
  const makeCtx = () => ({
    request: new Request("https://api.myfi.test/x", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    }),
    server: null,
    set: {
      status: undefined as number | string | undefined,
      headers: {} as Record<string, string>,
    },
  });

  test("passes under the limit and sets no status", () => {
    const hook = rateLimit({ name: "t", windowMs: 1000, max: 2 });
    const ctx = makeCtx();

    expect(hook(ctx)).toBeUndefined();
    expect(ctx.set.status).toBeUndefined();
  });

  test("returns a 429 with Retry-After once the limit is exceeded", () => {
    const hook = rateLimit({ name: "t", windowMs: 1000, max: 1 });
    const first = makeCtx();
    const second = makeCtx();

    hook(first);
    const body = hook(second);

    expect(second.set.status).toBe(429);
    expect(second.set.headers["retry-after"]).toBeDefined();
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  test("keys separate client IPs into separate buckets", () => {
    const hook = rateLimit({ name: "t", windowMs: 1000, max: 1 });

    const a = makeCtx();
    const b = {
      ...makeCtx(),
      request: new Request("https://api.myfi.test/x", {
        headers: { "x-forwarded-for": "198.51.100.9" },
      }),
    };

    hook(a);
    expect(hook(b)).toBeUndefined();
    expect(b.set.status).toBeUndefined();
  });
});
