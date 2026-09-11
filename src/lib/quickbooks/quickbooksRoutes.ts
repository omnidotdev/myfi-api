import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { QBO_CLIENT_ID, QBO_REDIRECT_URI } from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import {
  connectedAccountTable,
  quickbooksMigrationTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";
import { runBackfill } from "./backfill";
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

      // URLSearchParams percent-encodes the redirect_uri for us; the bookId is
      // carried through as state so the callback can resolve the book
      const params = new URLSearchParams({
        client_id: QBO_CLIENT_ID ?? "",
        response_type: "code",
        scope: QBO_ACCOUNTING_SCOPE,
        redirect_uri: QBO_REDIRECT_URI ?? "",
        state: bookId,
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
  );

export default quickbooksRoutes;
