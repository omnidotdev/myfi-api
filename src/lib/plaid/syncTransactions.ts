import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  connectedAccountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";
import plaidClient from "./plaidClient";

import type { SelectConnectedAccount } from "lib/db/schema";

/**
 * Look up the default debit and credit account IDs for a given event type.
 * Falls back to `null` if no mapping exists.
 * @param bookId - Book to look up mappings for.
 * @param eventType - Event type key (e.g. "plaid_expense", "plaid_income").
 */
const getAccountMapping = async (bookId: string, eventType: string) => {
  const [mapping] = await dbPool
    .select()
    .from(accountMappingTable)
    .where(
      and(
        eq(accountMappingTable.bookId, bookId),
        eq(accountMappingTable.eventType, eventType),
      ),
    );

  return mapping ?? null;
};

/**
 * Sync transactions from Plaid for a connected account.
 * Uses `transactionsSync` cursor-based pagination and deduplicates
 * via `sourceReferenceId` on the journal entry.
 * @param connectedAccount - Connected account record with access token.
 */
const syncTransactions = async (
  connectedAccount: Pick<
    SelectConnectedAccount,
    "id" | "bookId" | "accessToken"
  >,
) => {
  if (!connectedAccount.accessToken) {
    throw new Error("Connected account has no access token");
  }

  const accessToken = decryptToken(connectedAccount.accessToken);

  let cursor: string | undefined;
  let hasMore = true;
  let addedCount = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const { added, next_cursor, has_more } = response.data;

    for (const txn of added) {
      // Skip if already imported (idempotent via source reference)
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

      const amount = Math.abs(txn.amount);
      // Plaid uses negative values for income
      const isIncome = txn.amount < 0;
      const eventType = isIncome ? "plaid_income" : "plaid_expense";

      const mapping = await getAccountMapping(
        connectedAccount.bookId,
        eventType,
      );

      // Skip transaction if no account mapping is configured
      if (!mapping) continue;

      const [entry] = await dbPool
        .insert(journalEntryTable)
        .values({
          bookId: connectedAccount.bookId,
          date: txn.date,
          memo: txn.name ?? txn.merchant_name ?? "Plaid transaction",
          source: "plaid_import",
          sourceReferenceId: txn.transaction_id,
          isReviewed: false,
          isReconciled: false,
        })
        .returning();

      await dbPool.insert(journalLineTable).values([
        {
          journalEntryId: entry.id,
          accountId: mapping.debitAccountId,
          debit: amount.toFixed(4),
          credit: "0.0000",
        },
        {
          journalEntryId: entry.id,
          accountId: mapping.creditAccountId,
          debit: "0.0000",
          credit: amount.toFixed(4),
        },
      ]);

      addedCount++;
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  // Update last synced timestamp
  await dbPool
    .update(connectedAccountTable)
    .set({ lastSyncedAt: new Date().toISOString() })
    .where(eq(connectedAccountTable.id, connectedAccount.id));

  return { addedCount };
};

export default syncTransactions;
