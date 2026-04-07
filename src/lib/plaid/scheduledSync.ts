import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { connectedAccountTable, payrollConnectionTable } from "lib/db/schema";
import { syncPayroll } from "lib/payroll";
import syncTransactions from "./syncTransactions";

/**
 * Sync all active connected Plaid accounts.
 * Run each account sequentially to avoid rate limits
 */
const syncAllAccounts = async () => {
  const accounts = await dbPool
    .select()
    .from(connectedAccountTable)
    .where(eq(connectedAccountTable.status, "active"));

  let synced = 0;
  let errors = 0;

  for (const account of accounts) {
    if (account.provider !== "plaid" || !account.accessToken) continue;

    try {
      await syncTransactions(account);
      synced++;
    } catch (err) {
      errors++;
      console.error(
        `[ScheduledSync] Failed to sync account ${account.id}:`,
        err,
      );
    }
  }

  // Sync OFX Direct Connect accounts
  for (const account of accounts) {
    if (account.provider !== "ofx_direct" || !account.accessToken) continue;

    try {
      const { decryptToken } = await import("lib/encryption/tokenEncryption");
      const { fetchOfxTransactions } = await import("lib/ofx/ofxClient");
      const { importTransactions } = await import("lib/import");

      const config = JSON.parse(decryptToken(account.accessToken));
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const transactions = await fetchOfxTransactions(config, ninetyDaysAgo);

      await importTransactions({
        bookId: account.bookId,
        source: "ofx_import",
        transactions,
      });

      await dbPool
        .update(connectedAccountTable)
        .set({ lastSyncedAt: new Date().toISOString() })
        .where(eq(connectedAccountTable.id, account.id));

      synced++;
    } catch (err) {
      errors++;
      console.error(
        `[ScheduledSync] Failed to sync OFX account ${account.id}:`,
        err,
      );
    }
  }

  // Sync payroll connections
  const payrollConnections = await dbPool
    .select()
    .from(payrollConnectionTable)
    .where(eq(payrollConnectionTable.status, "active"));

  for (const connection of payrollConnections) {
    try {
      await syncPayroll(connection);
      synced++;
    } catch (err) {
      errors++;
      console.error(
        `[ScheduledSync] Failed to sync payroll ${connection.id}:`,
        err,
      );
    }
  }

  console.info(`[ScheduledSync] Complete: ${synced} synced, ${errors} errors`);
};

/**
 * Start the scheduled sync interval.
 * Run every 6 hours by default
 */
const startScheduledSync = (intervalMs = 6 * 60 * 60 * 1000) => {
  // Run once on startup after a short delay
  const startupDelay = setTimeout(() => {
    syncAllAccounts().catch(console.error);
  }, 10_000);

  const interval = setInterval(() => {
    syncAllAccounts().catch(console.error);
  }, intervalMs);

  return () => {
    clearTimeout(startupDelay);
    clearInterval(interval);
  };
};

export default startScheduledSync;
