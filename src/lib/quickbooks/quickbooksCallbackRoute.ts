import { sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";
import { encryptToken } from "lib/encryption/tokenEncryption";
import { verifyOauthState } from "lib/oauth/state";
import { exchangeCode } from "./quickbooksClient";
import { isQuickbooksConfigured } from "./quickbooksConfig";

/** Where the browser lands after a connection succeeds */
const SUCCESS_REDIRECT = "/settings/connections";

/** Where the browser lands on any failure (no secrets, lowercase) */
const ERROR_REDIRECT = "/settings/connections?error=quickbooks";

/**
 * QuickBooks OAuth callback route (public, registered before auth middleware).
 *
 * Intuit redirects the browser here with the authorization code, the realmId
 * (company id), and the state we set to the bookId. It exchanges the code for
 * tokens, stores them encrypted on a connected account, and redirects back
 * into the app.
 *
 * This is a top-level browser navigation, so every path redirects rather than
 * returning JSON. Nothing sensitive ever reaches the client: tokens and the
 * OAuth code are never placed in a response body or redirect URL, and any
 * failure redirects to a generic error page while the technical detail is
 * logged server-side
 */
export const quickbooksCallbackRoute = new Elysia().get(
  "/api/quickbooks/callback",
  async ({ query, redirect }) => {
    if (!isQuickbooksConfigured) {
      return redirect(ERROR_REDIRECT);
    }

    const { code, realmId, state, error } = query;

    // The user denied consent at Intuit (error param), or a required param is
    // missing, so there is nothing to exchange
    if (error || !code || !realmId) {
      return redirect(ERROR_REDIRECT);
    }

    // The state must be a valid HMAC-signed token this server minted at connect
    // time. A forged callback carrying a raw or tampered state is rejected here
    // before any token exchange, so it cannot link a company to another book.
    // Every verification failure maps to the same generic error page
    let bookId: string;
    try {
      ({ bookId } = verifyOauthState(state));
    } catch {
      return redirect(ERROR_REDIRECT);
    }

    try {
      const tokens = await exchangeCode(code, realmId);

      const accessToken = encryptToken(tokens.accessToken);
      const refreshToken = encryptToken(tokens.refreshToken);

      // Atomic upsert against the quickbooks-only partial unique index
      // (connected_account_book_quickbooks_idx). A single statement closes the
      // concurrent-connect race: two callbacks for the same book cannot both
      // insert a QuickBooks row. On reconnect the conflict updates the existing
      // row in place. Scoped by targetWhere so only the partial index is used,
      // leaving the many-per-book Plaid and ofx_direct rows untouched
      await dbPool
        .insert(connectedAccountTable)
        .values({
          bookId,
          provider: "quickbooks",
          realmId,
          accessToken,
          refreshToken,
          status: "active",
        })
        .onConflictDoUpdate({
          target: connectedAccountTable.bookId,
          targetWhere: sql`${connectedAccountTable.provider} = 'quickbooks'`,
          set: {
            realmId,
            accessToken,
            refreshToken,
            status: "active",
          },
        });

      return redirect(SUCCESS_REDIRECT);
    } catch (err) {
      // Log only the error class server-side, never a token, the OAuth code, or
      // a raw response body, and redirect to a generic error page
      const name = err instanceof Error ? err.name : "Error";
      console.error(`[QuickBooks] OAuth callback failed (${name})`);
      return redirect(ERROR_REDIRECT);
    }
  },
  {
    query: t.Object({
      code: t.Optional(t.String()),
      realmId: t.Optional(t.String()),
      state: t.String(),
      error: t.Optional(t.String()),
    }),
  },
);
