import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";
import inferCategory from "./inferCategory";
import matchRule from "./matchRule";

import type { TransactionContext } from "./matchRule";

const CONFIDENCE_THRESHOLD = 0.85;
export const AUTO_APPROVE_THRESHOLD = 0.9;

/** Result of the categorization pipeline */
interface CategorizationResult {
  debitAccountId: string;
  creditAccountId: string;
  confidence: number;
  source: "rule" | "llm";
  reasoning?: string;
  ruleId?: string;
  tagId?: string | null;
}

/**
 * Categorize a transaction by first trying rule matching, then LLM inference.
 * @param ctx - Transaction context for matching
 * @param bookId - Book to categorize within
 * @param bookType - Type of the book (e.g. "personal", "business")
 */
const categorize = async (
  ctx: TransactionContext,
  bookId: string,
  bookType: string,
): Promise<CategorizationResult | null> => {
  // 1. Try rule-based matching
  const ruleMatch = await matchRule(ctx, bookId, CONFIDENCE_THRESHOLD);

  if (ruleMatch) {
    return {
      debitAccountId: ruleMatch.debitAccountId,
      creditAccountId: ruleMatch.creditAccountId,
      confidence: ruleMatch.confidence,
      source: "rule",
      ruleId: ruleMatch.ruleId,
      tagId: ruleMatch.tagId,
    };
  }

  // 2. Fall back to LLM inference
  const accounts = await dbPool
    .select({
      id: accountTable.id,
      name: accountTable.name,
      code: accountTable.code,
      type: accountTable.type,
    })
    .from(accountTable)
    .where(
      and(eq(accountTable.bookId, bookId), eq(accountTable.isActive, true)),
    );

  const isIncome = ctx.amount < 0;

  const llmResult = await inferCategory({
    merchantName: ctx.merchantName,
    memo: ctx.memo,
    amount: Math.abs(ctx.amount),
    isIncome,
    bookType,
    accounts,
  });

  if (llmResult) {
    return {
      debitAccountId: llmResult.debitAccountId,
      creditAccountId: llmResult.creditAccountId,
      confidence: llmResult.confidence,
      source: "llm",
      reasoning: llmResult.reasoning,
    };
  }

  return null;
};

export default categorize;
