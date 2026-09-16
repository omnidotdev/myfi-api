import { Elysia, t } from "elysia";

import { runCloseReview } from "lib/review/closeReview";

/**
 * Automated close-review: runs the anomaly battery a bookkeeper works through
 * before closing a period and reports findings by severity. Read-only; the
 * bookId in the query is authorized by the global bookAccessMiddleware
 */
const closeReviewRoutes = new Elysia({ prefix: "/api/close" }).get(
  "/review",
  async ({ query, set }) => {
    const { bookId } = query;
    const year = Number.parseInt(query.year, 10);
    const month = Number.parseInt(query.month, 10);

    if (!bookId || !Number.isFinite(year) || !Number.isFinite(month)) {
      set.status = 400;
      return { error: "bookId, year, and month are required" };
    }
    if (month < 1 || month > 12) {
      set.status = 400;
      return { error: "month must be between 1 and 12" };
    }

    try {
      return await runCloseReview(bookId, year, month);
    } catch (err) {
      console.error("[close-review] failed:", err);
      set.status = 500;
      return { error: "Could not run the close review" };
    }
  },
  {
    query: t.Object({
      bookId: t.String(),
      year: t.String(),
      month: t.String(),
    }),
  },
);

export default closeReviewRoutes;
