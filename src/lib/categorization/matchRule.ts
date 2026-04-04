import { desc, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { categorizationRuleTable } from "lib/db/schema";

import type { SelectCategorizationRule } from "lib/db/schema";

/** Context extracted from a transaction for rule matching */
export interface TransactionContext {
  merchantName: string | null;
  memo: string | null;
  plaidCategory: string | null;
  amount: number;
}

/** Map rule matchField values to TransactionContext keys */
const fieldMap: Record<string, keyof TransactionContext> = {
  merchant_name: "merchantName",
  memo: "memo",
  plaid_category: "plaidCategory",
};

/** Check whether a rule's match criteria applies to the given value */
const ruleMatches = (
  rule: SelectCategorizationRule,
  value: string,
): boolean => {
  const matchValue = rule.matchValue.toLowerCase();
  const target = value.toLowerCase();

  switch (rule.matchType) {
    case "exact":
      return target === matchValue;
    case "contains":
      return target.includes(matchValue);
    case "starts_with":
      return target.startsWith(matchValue);
    case "regex":
      try {
        return new RegExp(matchValue, "i").test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
};

/**
 * Match a transaction against categorization rules for a book.
 * Returns the first matching rule above the confidence threshold, or null.
 * @param ctx - Transaction context to match against
 * @param bookId - Book whose rules to search
 * @param confidenceThreshold - Minimum confidence to accept a match
 */
const matchRule = async (
  ctx: TransactionContext,
  bookId: string,
  confidenceThreshold: number,
): Promise<{
  debitAccountId: string;
  creditAccountId: string;
  confidence: number;
  ruleId: string;
} | null> => {
  const rules = await dbPool
    .select()
    .from(categorizationRuleTable)
    .where(eq(categorizationRuleTable.bookId, bookId))
    .orderBy(desc(categorizationRuleTable.priority));

  for (const rule of rules) {
    const contextKey = fieldMap[rule.matchField];
    if (!contextKey) continue;

    const fieldValue = ctx[contextKey];
    if (fieldValue == null) continue;

    // Amount range filtering
    if (rule.amountMin != null && ctx.amount < Number(rule.amountMin)) continue;
    if (rule.amountMax != null && ctx.amount > Number(rule.amountMax)) continue;

    if (!ruleMatches(rule, String(fieldValue))) continue;

    const confidence = Number(rule.confidence);
    if (confidence < confidenceThreshold) continue;

    // Update hit statistics
    await dbPool
      .update(categorizationRuleTable)
      .set({
        hitCount: sql`${categorizationRuleTable.hitCount} + 1`,
        lastHitAt: new Date().toISOString(),
      })
      .where(eq(categorizationRuleTable.id, rule.id));

    return {
      debitAccountId: rule.debitAccountId,
      creditAccountId: rule.creditAccountId,
      confidence,
      ruleId: rule.id,
    };
  }

  return null;
};

export default matchRule;
