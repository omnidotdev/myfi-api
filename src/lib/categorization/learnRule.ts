import { and, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  categorizationRuleSplitTable,
  categorizationRuleTable,
} from "lib/db/schema";

interface SplitInput {
  accountId: string;
  side: string;
  percentage?: string | null;
  fixedAmount?: string | null;
  memo?: string | null;
  tagId?: string | null;
}

/**
 * Create or update a categorization rule from a user approval or correction.
 * Learns merchant-based rules so future transactions auto-categorize. When
 * `splits` are provided (two or more lines), the rule is persisted with split
 * lines instead of relying solely on the single debit/credit accounts
 */
const learnRule = async (
  bookId: string,
  merchantName: string,
  debitAccountId: string,
  creditAccountId: string,
  splits?: SplitInput[],
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

  const hasSplits = !!splits && splits.length >= 2;

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

    if (hasSplits) {
      await dbPool
        .delete(categorizationRuleSplitTable)
        .where(eq(categorizationRuleSplitTable.ruleId, existing.id));

      await dbPool.insert(categorizationRuleSplitTable).values(
        splits!.map((split, index) => ({
          ruleId: existing.id,
          accountId: split.accountId,
          side: split.side,
          percentage: split.percentage ?? null,
          fixedAmount: split.fixedAmount ?? null,
          memo: split.memo ?? null,
          tagId: split.tagId ?? null,
          sortOrder: index,
        })),
      );
    }
  } else {
    const [rule] = await dbPool
      .insert(categorizationRuleTable)
      .values({
        bookId,
        name: `Auto: ${normalizedMerchant}`,
        matchField: "merchant_name",
        matchType: "exact",
        matchValue: normalizedMerchant,
        debitAccountId,
        creditAccountId,
        confidence: "0.95",
        priority: 10,
      })
      .returning();

    if (hasSplits && rule) {
      await dbPool.insert(categorizationRuleSplitTable).values(
        splits!.map((split, index) => ({
          ruleId: rule.id,
          accountId: split.accountId,
          side: split.side,
          percentage: split.percentage ?? null,
          fixedAmount: split.fixedAmount ?? null,
          memo: split.memo ?? null,
          tagId: split.tagId ?? null,
          sortOrder: index,
        })),
      );
    }
  }
};

export default learnRule;
