import { Elysia, t } from "elysia";

import { suggestCategory } from "lib/categorization/suggestCategory";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { rateLimit } from "lib/middleware/rateLimit";

// Each suggestion is a metered LLM call through the Synapse gateway, so cap
// per-caller volume to bound AI spend and abuse. 30 suggestions/minute/identity
const suggestRateLimit = rateLimit({
  name: "categorization-suggest",
  windowMs: 60_000,
  max: 30,
});

/**
 * Typed body for the included-allowance cap, so the app can render an upgrade
 * prompt instead of a generic failure
 */
const ALLOWANCE_USED_BODY = {
  code: "ai_allowance_used",
  error: "AI categorization used for this period",
} as const;

/**
 * AI-assisted categorization: suggests a debit/credit pairing + rationale for a
 * transaction, for the owner to approve. Billed to the book's workspace under
 * its included AI allowance. Returns 402 with a typed `ai_allowance_used` body
 * once that allowance is used for the period, and 503 when AI is unavailable
 * (not configured or the gateway failed). Book access is enforced by the global
 * middleware; the handler resolves the caller to mint the key under them
 */
const categorizationSuggestRoutes = new Elysia({
  prefix: "/api/categorization",
}).post(
  "/suggest",
  async ({ body, request, set }) => {
    const auth = await authorizeBook(request, body.bookId, "editor", set);
    if (!auth) return { error: "Forbidden" };

    try {
      const outcome = await suggestCategory(
        body.bookId,
        {
          description: body.description,
          amount: body.amount,
          date: body.date,
        },
        auth.userId,
      );

      if (outcome.status === "allowance_used") {
        set.status = 402;
        return ALLOWANCE_USED_BODY;
      }

      if (outcome.status === "unavailable") {
        set.status = 503;
        return { error: "AI categorization is unavailable right now" };
      }

      if (!outcome.value) {
        set.status = 422;
        return { error: "No confident suggestion for this transaction" };
      }

      return { suggestion: outcome.value };
    } catch (err) {
      console.error("[categorization] suggest failed:", err);
      set.status = 500;
      return { error: "Could not generate a suggestion" };
    }
  },
  {
    beforeHandle: ({ request, server, set }) =>
      suggestRateLimit({ request, server, set }),
    body: t.Object({
      bookId: t.String(),
      description: t.String(),
      amount: t.Number(),
      date: t.String(),
    }),
  },
);

export default categorizationSuggestRoutes;
