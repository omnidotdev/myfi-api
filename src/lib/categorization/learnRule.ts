import { and, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { categorizationRuleTable } from "lib/db/schema";

/**
 * Create or update a categorization rule from a user approval or correction.
 * Learns merchant-based rules so future transactions auto-categorize
 */
const learnRule = async (
  bookId: string,
  merchantName: string,
  debitAccountId: string,
  creditAccountId: string,
): Promise<void> => {
  const normalizedMerchant = merchantName.toLowerCase().trim();

  if (!normalizedMerchant) return;

  const [existing] = await dbPool
    .select()
    .from(categorizationRuleTable)
    .where(
      and(
        eq(categorizationRuleTable.bookId, bookId),
        eq(categorizationRuleTable.matchField, "merchant_name"),
        eq(categorizationRuleTable.matchValue, normalizedMerchant),
      ),
    );

  if (existing) {
    await dbPool
      .update(categorizationRuleTable)
      .set({
        debitAccountId,
        creditAccountId,
        hitCount: sql`${categorizationRuleTable.hitCount} + 1`,
        lastHitAt: new Date().toISOString(),
      })
      .where(eq(categorizationRuleTable.id, existing.id));
  } else {
    await dbPool.insert(categorizationRuleTable).values({
      bookId,
      name: `Auto: ${normalizedMerchant}`,
      matchField: "merchant_name",
      matchType: "exact",
      matchValue: normalizedMerchant,
      debitAccountId,
      creditAccountId,
      confidence: "0.95",
      priority: 10,
    });
  }
};

export default learnRule;
