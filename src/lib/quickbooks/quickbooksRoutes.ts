import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { QBO_CLIENT_ID, QBO_REDIRECT_URI } from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import {
  connectedAccountTable,
  quickbooksCutoverTable,
  quickbooksMigrationTable,
  quickbooksReconciliationLineTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";
import { signOauthState } from "lib/oauth/state";
import { runBackfill } from "./backfill";
import { CutoverNotReconciledError, runCutover } from "./cutover";
import { QBO_AUTHORIZE_URL, isQuickbooksConfigured } from "./quickbooksConfig";
import { runReconciliation } from "./reconcile";

/** OAuth scope granting read access to a company's accounting data */
const QBO_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";

/**
 * Protected QuickBooks routes (registered after auth middleware).
 *
 * bookId is read from the request body, the same mechanism connectionRoutes and
 * payrollRoutes use, so bookAccessMiddleware can authorize the book before the
 * handler runs
 */
const quickbooksRoutes = new Elysia({ prefix: "/api/quickbooks" })
  .post(
    "/connect",
    async ({ body, set }) => {
      if (!isQuickbooksConfigured) {
        set.status = 500;
        return { error: "QuickBooks not configured" };
      }

      const { bookId } = body;

      // URLSearchParams percent-encodes the redirect_uri for us. The bookId is
      // carried in an HMAC-signed state (not the raw id) so the callback can
      // trust it: only the server can mint a state for a given book, so a forged
      // callback cannot link an attacker's company to a victim's book
      const params = new URLSearchParams({
        client_id: QBO_CLIENT_ID ?? "",
        response_type: "code",
        scope: QBO_ACCOUNTING_SCOPE,
        redirect_uri: QBO_REDIRECT_URI ?? "",
        state: signOauthState(bookId),
      });

      const authUrl = `${QBO_AUTHORIZE_URL}?${params.toString()}`;

      return { authUrl };
    },
    {
      body: t.Object({ bookId: t.String() }),
    },
  )
  .post(
    "/backfill",
    async ({ body, set }) => {
      const { bookId, connectedAccountId, periodStart, periodEnd } = body;

      // Authorization boundary: bookAccessMiddleware verified the caller may
      // access bookId, but NOT that this connected account belongs to it.
      // Without this check a caller could pull another tenant's QuickBooks data
      // into their own ledger, so reject a mismatched or non-QBO account with a
      // generic 403 before any work happens
      const [account] = await dbPool
        .select({
          id: connectedAccountTable.id,
          bookId: connectedAccountTable.bookId,
          provider: connectedAccountTable.provider,
        })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, connectedAccountId));

      if (
        !account ||
        account.bookId !== bookId ||
        account.provider !== "quickbooks"
      ) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      const [migration] = await dbPool
        .insert(quickbooksMigrationTable)
        .values({
          bookId,
          connectedAccountId,
          status: "pending",
          periodStart: periodStart ?? null,
          periodEnd: periodEnd ?? null,
        })
        .returning();

      // A full backfill can span years and exceed ingress/LB timeouts, so run
      // it fire-and-forget: the quickbooks_migration row is the status channel
      // (GraphQL-readable) and runBackfill records its own success or failure
      // onto it. The catch keeps a rejection from surfacing as an unhandled
      // rejection and logs the error class only server-side (never the message,
      // stack, or any token), since the migration row already carries a generic
      // failure message
      const migrationId = migration.id;
      void runBackfill({
        migrationId,
        bookId,
        connectedAccountId,
      }).catch((err) =>
        console.error(
          `[QuickBooks] backfill ${migrationId} failed (${err instanceof Error ? err.name : "unknown"})`,
        ),
      );

      set.status = 202;
      return { migrationId };
    },
    {
      body: t.Object({
        bookId: t.String(),
        connectedAccountId: t.String(),
        periodStart: t.Optional(t.String()),
        periodEnd: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/reconcile",
    async ({ body, set }) => {
      const { bookId, connectedAccountId, periodStart, periodEnd } = body;

      // Authorization boundary: bookAccessMiddleware verified the caller may
      // access bookId, but NOT that this connected account belongs to it.
      // Without this check a caller could reconcile against another tenant's
      // QuickBooks company, so reject a mismatched or non-QBO account with a
      // generic 403 before any work happens
      const [account] = await dbPool
        .select({
          id: connectedAccountTable.id,
          bookId: connectedAccountTable.bookId,
          provider: connectedAccountTable.provider,
        })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, connectedAccountId));

      if (
        !account ||
        account.bookId !== bookId ||
        account.provider !== "quickbooks"
      ) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      // A malformed or inverted period is a client error, so reject it
      // synchronously with a generic 400 rather than letting the async worker
      // fail the run downstream. The message echoes none of the raw input
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      if (
        !ISO_DATE.test(periodStart) ||
        !ISO_DATE.test(periodEnd) ||
        periodStart > periodEnd
      ) {
        set.status = 400;
        return { error: "Invalid period" };
      }

      const [reconciliation] = await dbPool
        .insert(quickbooksReconciliationTable)
        .values({
          bookId,
          connectedAccountId,
          status: "pending",
          periodStart,
          periodEnd,
        })
        .returning();

      // Reconciliation fetches and diffs a whole period's trial balance, which
      // can exceed ingress/LB timeouts, so run it fire-and-forget: the
      // quickbooks_reconciliation row is the status channel (GraphQL-readable)
      // and runReconciliation records its own success or failure onto it. The
      // catch keeps a rejection from surfacing as an unhandled rejection and
      // logs the error class only server-side (never the message, stack, or any
      // token), since the run row already carries a generic failure message
      const reconciliationId = reconciliation.id;
      void runReconciliation({
        reconciliationId,
        bookId,
        connectedAccountId,
      }).catch((err) =>
        console.error(
          `[QuickBooks] reconciliation ${reconciliationId} failed (${err instanceof Error ? err.name : "unknown"})`,
        ),
      );

      set.status = 202;
      return { reconciliationId };
    },
    {
      body: t.Object({
        bookId: t.String(),
        connectedAccountId: t.String(),
        periodStart: t.String(),
        periodEnd: t.String(),
      }),
    },
  )
  .post(
    "/cutover",
    async ({ body, set }) => {
      const { bookId, connectedAccountId, reconciliationId } = body;

      // Authorization boundary: bookAccessMiddleware verified the caller may
      // access bookId, but NOT that this connected account belongs to it.
      // Without this check a caller could cut over another tenant's book, so
      // reject a mismatched or non-QBO account with a generic 403 before any
      // work happens
      const [account] = await dbPool
        .select({
          id: connectedAccountTable.id,
          bookId: connectedAccountTable.bookId,
          provider: connectedAccountTable.provider,
        })
        .from(connectedAccountTable)
        .where(eq(connectedAccountTable.id, connectedAccountId));

      if (
        !account ||
        account.bookId !== bookId ||
        account.provider !== "quickbooks"
      ) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      // Cutover is fast (a couple writes plus one best-effort revoke), so run it
      // synchronously rather than fire-and-forget. It is gated on a clean
      // tie-out: a book that has not reconciled cleanly is a distinct, blocked
      // state (409), separate from an unexpected failure (500)
      try {
        const { cutoverId, alreadyCutOver } = await runCutover({
          bookId,
          connectedAccountId,
          reconciliationId,
        });

        set.status = 200;
        return { cutoverId, alreadyCutOver };
      } catch (err) {
        if (err instanceof CutoverNotReconciledError) {
          set.status = 409;
          return { error: "Book has not reconciled cleanly" };
        }

        // Log the error class only server-side (never the message, stack, or
        // any token) and return a generic failure carrying no internals
        console.error(
          `[QuickBooks] cutover failed (${err instanceof Error ? err.name : "unknown"})`,
        );
        set.status = 500;
        return { error: "Cutover failed" };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        connectedAccountId: t.String(),
        reconciliationId: t.String(),
      }),
    },
  )
  .get(
    "/status",
    async ({ query, set }) => {
      const { bookId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      // Every select below is scoped by bookId, so the state returned belongs
      // only to the requested book. An absent row is a valid state (a book that
      // never connected QuickBooks), returned as null rather than an error
      const [connection] = await dbPool
        .select({
          id: connectedAccountTable.id,
          realmId: connectedAccountTable.realmId,
          status: connectedAccountTable.status,
        })
        .from(connectedAccountTable)
        .where(
          and(
            eq(connectedAccountTable.bookId, bookId),
            eq(connectedAccountTable.provider, "quickbooks"),
          ),
        )
        .limit(1);

      const [latestMigration] = await dbPool
        .select({
          id: quickbooksMigrationTable.id,
          status: quickbooksMigrationTable.status,
          periodStart: quickbooksMigrationTable.periodStart,
          periodEnd: quickbooksMigrationTable.periodEnd,
          entriesImported: quickbooksMigrationTable.entriesImported,
          errorMessage: quickbooksMigrationTable.errorMessage,
          createdAt: quickbooksMigrationTable.createdAt,
        })
        .from(quickbooksMigrationTable)
        .where(eq(quickbooksMigrationTable.bookId, bookId))
        .orderBy(desc(quickbooksMigrationTable.createdAt))
        .limit(1);

      const [latestReconciliation] = await dbPool
        .select({
          id: quickbooksReconciliationTable.id,
          status: quickbooksReconciliationTable.status,
          periodStart: quickbooksReconciliationTable.periodStart,
          periodEnd: quickbooksReconciliationTable.periodEnd,
          totalVariance: quickbooksReconciliationTable.totalVariance,
          mismatchCount: quickbooksReconciliationTable.mismatchCount,
          errorMessage: quickbooksReconciliationTable.errorMessage,
          createdAt: quickbooksReconciliationTable.createdAt,
        })
        .from(quickbooksReconciliationTable)
        .where(eq(quickbooksReconciliationTable.bookId, bookId))
        .orderBy(desc(quickbooksReconciliationTable.createdAt))
        .limit(1);

      const [cutover] = await dbPool
        .select({
          id: quickbooksCutoverTable.id,
          cutoverAt: quickbooksCutoverTable.cutoverAt,
          reconciliationId: quickbooksCutoverTable.reconciliationId,
        })
        .from(quickbooksCutoverTable)
        .where(eq(quickbooksCutoverTable.bookId, bookId))
        .limit(1);

      return {
        connection: connection ?? null,
        latestMigration: latestMigration ?? null,
        latestReconciliation: latestReconciliation ?? null,
        cutover: cutover ?? null,
      };
    },
    {
      query: t.Object({ bookId: t.Optional(t.String()) }),
    },
  )
  .get(
    "/reconciliation/:reconciliationId/lines",
    async ({ params, query, set }) => {
      const { bookId } = query;

      if (!bookId) {
        set.status = 400;
        return { error: "bookId is required" };
      }

      const { reconciliationId } = params;

      // IDOR boundary: bookAccessMiddleware verified the caller may access
      // bookId, but NOT that this reconciliation belongs to it. Load the run and
      // reject with a generic 404 when it is missing OR owned by another book,
      // so the response never reveals whether a run exists for a different book
      const [reconciliation] = await dbPool
        .select({
          id: quickbooksReconciliationTable.id,
          bookId: quickbooksReconciliationTable.bookId,
          status: quickbooksReconciliationTable.status,
          totalVariance: quickbooksReconciliationTable.totalVariance,
          mismatchCount: quickbooksReconciliationTable.mismatchCount,
          periodStart: quickbooksReconciliationTable.periodStart,
          periodEnd: quickbooksReconciliationTable.periodEnd,
        })
        .from(quickbooksReconciliationTable)
        .where(eq(quickbooksReconciliationTable.id, reconciliationId))
        .limit(1);

      if (!reconciliation || reconciliation.bookId !== bookId) {
        set.status = 404;
        return { error: "Not found" };
      }

      const lines = await dbPool
        .select({
          id: quickbooksReconciliationLineTable.id,
          accountName: quickbooksReconciliationLineTable.accountName,
          qboAccountId: quickbooksReconciliationLineTable.qboAccountId,
          myfiAccountId: quickbooksReconciliationLineTable.myfiAccountId,
          qboBalance: quickbooksReconciliationLineTable.qboBalance,
          myfiBalance: quickbooksReconciliationLineTable.myfiBalance,
          variance: quickbooksReconciliationLineTable.variance,
        })
        .from(quickbooksReconciliationLineTable)
        .where(
          and(
            eq(
              quickbooksReconciliationLineTable.reconciliationId,
              reconciliationId,
            ),
            eq(quickbooksReconciliationLineTable.bookId, bookId),
          ),
        )
        .orderBy(quickbooksReconciliationLineTable.accountName);

      return {
        reconciliation: {
          id: reconciliation.id,
          status: reconciliation.status,
          totalVariance: reconciliation.totalVariance,
          mismatchCount: reconciliation.mismatchCount,
          periodStart: reconciliation.periodStart,
          periodEnd: reconciliation.periodEnd,
        },
        lines,
      };
    },
    {
      params: t.Object({ reconciliationId: t.String() }),
      query: t.Object({ bookId: t.Optional(t.String()) }),
    },
  );

export default quickbooksRoutes;
