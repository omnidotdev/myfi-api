import { identityKey } from "@omnidotdev/providers/server";

/**
 * In-memory per-identity rate limiting for expensive REST endpoints.
 *
 * GraphQL is already guarded by graphql-armor cost limits; the REST surface has
 * no equivalent. This is a lightweight fixed-window limiter, scoped to a single
 * process (no shared store), which is sufficient for alpha: a handful of API
 * replicas each enforce the window locally. Swap the store for a shared one
 * (e.g. the billing/credit path) before this needs to be exact across replicas
 */

type RateLimitDecision = {
  /** Whether this request is within the window budget */
  allowed: boolean;
  /** Requests left in the current window after this one */
  remaining: number;
  /** Seconds until the window resets (0 when allowed) */
  retryAfterSeconds: number;
};

type RateLimiterOptions = {
  /** Window length in milliseconds */
  windowMs: number;
  /** Max requests permitted per key per window */
  max: number;
  /** Clock injection point for deterministic tests */
  now?: () => number;
};

type Bucket = { count: number; windowStart: number };

// Sweep expired buckets once the map crosses this size, so a long-lived process
// seeing many distinct keys does not grow the map without bound
const PRUNE_THRESHOLD = 10_000;

/**
 * Create a fixed-window rate limiter. Each key gets its own window; the first
 * request in a window starts the clock, and the key resets once the window
 * elapses.
 * @param options - Window length, per-window max, and optional clock
 * @returns An object whose `check(key)` records a hit and returns the decision
 */
export const createRateLimiter = ({
  windowMs,
  max,
  now = Date.now,
}: RateLimiterOptions) => {
  const buckets = new Map<string, Bucket>();

  const prune = (currentTime: number) => {
    for (const [key, bucket] of buckets) {
      if (currentTime - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  };

  const check = (key: string): RateLimitDecision => {
    const currentTime = now();

    if (buckets.size > PRUNE_THRESHOLD) prune(currentTime);

    let bucket = buckets.get(key);

    if (!bucket || currentTime - bucket.windowStart >= windowMs) {
      bucket = { count: 0, windowStart: currentTime };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const allowed = bucket.count <= max;
    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = allowed
      ? 0
      : Math.ceil((bucket.windowStart + windowMs - currentTime) / 1000);

    return { allowed, remaining, retryAfterSeconds };
  };

  return { check };
};

/**
 * Minimal slice of the Elysia handler context this hook reads. Kept structural
 * (and permissive on `set.headers`) so the real Elysia context is assignable
 * when the hook is invoked from an inline `beforeHandle` wrapper
 */
type RateLimitContext = {
  request: Request;
  server: {
    requestIP?: (request: Request) => { address?: string } | null;
  } | null;
  set: {
    status?: number | string;
    headers: Record<string, string | number | string[] | undefined>;
  };
};

type RateLimitHookOptions = RateLimiterOptions & {
  /** Namespace so different endpoints do not share a key bucket */
  name: string;
};

/**
 * Build an Elysia `beforeHandle` hook that rate-limits by caller identity.
 *
 * Requests are bucketed per identity via the shared providers identity key
 * (the Bearer token subject when present, otherwise the client IP from
 * `x-forwarded-for`/`x-real-ip`/socket), so callers behind one NAT do not share
 * a bucket. Over the limit, it short-circuits with a 429 and a `Retry-After`
 * header and never reaches the handler. The message is generic and leaks no
 * internal detail.
 * @param options - Limiter window/max plus a `name` namespace
 */
export const rateLimit = (options: RateLimitHookOptions) => {
  const limiter = createRateLimiter(options);

  return (context: RateLimitContext) => {
    const id = identityKey({
      headers: context.request.headers,
      socketIp: context.server?.requestIP?.(context.request)?.address,
    });

    const decision = limiter.check(`${options.name}:${id}`);

    if (!decision.allowed) {
      context.set.status = 429;
      context.set.headers["retry-after"] = String(decision.retryAfterSeconds);

      return {
        error: "Rate limit exceeded",
        message: "Too many requests. Please retry shortly.",
      };
    }
  };
};
