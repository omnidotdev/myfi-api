import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { connectedAccountTable, journalEntryTable } from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";
import { processTransaction } from "lib/import/processTransaction";
import plaidClient from "./plaidClient";

import type { SelectConnectedAccount } from "lib/db/schema";

/**
 * Sync transactions from Plaid for a connected account.
 * Uses cursor-based pagination and deduplicates via sourceReferenceId.
 * Delegates categorization and journal creation to processTransaction
 */
const syncTransactions = async (
  connectedAccount: Pick<
    SelectConnectedAccount,
    "id" | "bookId" | "accessToken" | "syncCursor"
  >,
) => {
  if (!connectedAccount.accessToken) {
    throw new Error("Connected account has no access token");
  }

  const accessToken = decryptToken(connectedAccount.accessToken);

  let cursor: string | undefined = connectedAccount.syncCursor ?? undefined;
  let hasMore = true;
  let addedCount = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const { added, next_cursor, has_more } = response.data;

    for (const txn of added) {
      // Deduplicate via source reference
      const [existing] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(
          and(
            eq(journalEntryTable.bookId, connectedAccount.bookId),
            eq(journalEntryTable.source, "plaid_import"),
            eq(journalEntryTable.sourceReferenceId, txn.transaction_id),
          ),
        );

      if (existing) continue;

      await processTransaction(
        {
          date: txn.date,
          amount: txn.amount,
          memo: txn.name ?? txn.merchant_name ?? "Plaid transaction",
          merchantName: txn.merchant_name ?? null,
          referenceId: txn.transaction_id,
          plaidCategory: txn.personal_finance_category?.primary ?? null,
        },
        {
          bookId: connectedAccount.bookId,
          source: "plaid_import",
        },
      );

      addedCount++;
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  // Update sync state
  await dbPool
    .update(connectedAccountTable)
    .set({
      lastSyncedAt: new Date().toISOString(),
      syncCursor: cursor,
    })
    .where(eq(connectedAccountTable.id, connectedAccount.id));

  return { addedCount };
};

export default syncTransactions;
