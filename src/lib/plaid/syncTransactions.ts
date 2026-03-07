import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  connectedAccountTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";
import plaidClient from "./plaidClient";

import type { SelectConnectedAccount } from "lib/db/schema";

/**
 * Find the best account mapping for a Plaid transaction.
 * Priority: merchant → Plaid category → generic income/expense.
 * @param bookId - Book to look up mappings for.
 * @param merchantName - Merchant name from Plaid transaction.
 * @param plaidCategory - Primary personal finance category from Plaid.
 * @param isIncome - Whether the transaction is income.
 */
const findBestMapping = async (
  bookId: string,
  merchantName: string | null | undefined,
  plaidCategory: string | null | undefined,
  isIncome: boolean,
) => {
  // 1. Try merchant-specific mapping (e.g. "merchant:stripe")
  if (merchantName) {
    const normalized = merchantName.toLowerCase().trim();
    const [merchantMapping] = await dbPool
      .select()
      .from(accountMappingTable)
      .where(
        and(
          eq(accountMappingTable.bookId, bookId),
          eq(accountMappingTable.eventType, `merchant:${normalized}`),
        ),
      );
    if (merchantMapping) return merchantMapping;
  }

  // 2. Try Plaid category mapping (e.g. "category:FOOD_AND_DRINK.RESTAURANTS")
  if (plaidCategory) {
    const [fullCatMapping] = await dbPool
      .select()
      .from(accountMappingTable)
      .where(
        and(
          eq(accountMappingTable.bookId, bookId),
          eq(accountMappingTable.eventType, `category:${plaidCategory}`),
        ),
      );
    if (fullCatMapping) return fullCatMapping;

    // Try top-level category (e.g. "category:FOOD_AND_DRINK")
    const topLevel = plaidCategory.split(".")[0];
    if (topLevel !== plaidCategory) {
      const [topCatMapping] = await dbPool
        .select()
        .from(accountMappingTable)
        .where(
          and(
            eq(accountMappingTable.bookId, bookId),
            eq(accountMappingTable.eventType, `category:${topLevel}`),
          ),
        );
      if (topCatMapping) return topCatMapping;
    }
  }

  // 3. Fall back to generic plaid_income / plaid_expense
  const eventType = isIncome ? "plaid_income" : "plaid_expense";
  const [genericMapping] = await dbPool
    .select()
    .from(accountMappingTable)
    .where(
      and(
        eq(accountMappingTable.bookId, bookId),
        eq(accountMappingTable.eventType, eventType),
      ),
    );

  return genericMapping ?? null;
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
      const plaidCategory = txn.personal_finance_category?.primary ?? null;

      const mapping = await findBestMapping(
        connectedAccount.bookId,
        txn.merchant_name,
        plaidCategory,
        isIncome,
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

      await dbPool.insert(reconciliationQueueTable).values({
        bookId: connectedAccount.bookId,
        journalEntryId: entry.id,
        status: "pending_review",
      });

      addedCount++;
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  // Update last synced timestamp
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
