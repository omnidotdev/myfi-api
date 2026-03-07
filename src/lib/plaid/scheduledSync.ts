import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { connectedAccountTable } from "lib/db/schema";
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

  console.info(
    `[ScheduledSync] Complete: ${synced} synced, ${errors} errors`,
  );
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
