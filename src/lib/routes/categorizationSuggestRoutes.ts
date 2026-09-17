import { Elysia, t } from "elysia";

import {
  isCategorizationAiEnabled,
  suggestCategory,
} from "lib/categorization/suggestCategory";

/**
 * AI-assisted categorization: suggests a debit/credit pairing + rationale for a
 * transaction, for the owner to approve. Degrades gracefully (503) when no
 * ANTHROPIC_API_KEY is configured. Book access enforced by the global middleware
 */
const categorizationSuggestRoutes = new Elysia({
  prefix: "/api/categorization",
}).post(
  "/suggest",
  async ({ body, set }) => {
    if (!isCategorizationAiEnabled()) {
      set.status = 503;
      return { error: "AI categorization is not configured" };
    }

    try {
      const suggestion = await suggestCategory(body.bookId, {
        description: body.description,
        amount: body.amount,
        date: body.date,
      });

      if (!suggestion) {
        set.status = 422;
        return { error: "No confident suggestion for this transaction" };
      }

      return { suggestion };
    } catch (err) {
      console.error("[categorization] suggest failed:", err);
      set.status = 500;
      return { error: "Could not generate a suggestion" };
    }
  },
  {
    body: t.Object({
      bookId: t.String(),
      description: t.String(),
      amount: t.Number(),
      date: t.String(),
    }),
  },
);

export default categorizationSuggestRoutes;
