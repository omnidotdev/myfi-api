import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

// Default to the most capable model; override to a cheaper one (e.g.
// claude-haiku-4-5) for high-volume categorization via env
const MODEL = process.env.MYFI_CATEGORIZATION_MODEL ?? "claude-opus-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.warn(
    "ANTHROPIC_API_KEY not set, AI categorization suggestions disabled",
  );
}

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

export const isCategorizationAiEnabled = () => client !== null;

export type SuggestAccount = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  subType: string | null;
};

type SuggestTransaction = {
  description: string;
  amount: number;
  date: string;
};

type CategorySuggestion = {
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  confidence: number;
  rationale: string;
};

// =============================================================================
// Pure helpers (unit-tested without the API)
// =============================================================================

/** Compact chart-of-accounts listing the model chooses from (ids included) */
export const buildAccountList = (accounts: SuggestAccount[]): string =>
  accounts
    .map(
      (a) =>
        `- id=${a.id} | ${a.code ? `${a.code} ` : ""}${a.name} (${a.type}${a.subType ? `/${a.subType}` : ""})`,
    )
    .join("\n");

export const buildPrompt = (
  accounts: SuggestAccount[],
  txn: SuggestTransaction,
): string =>
  `Chart of accounts:\n${buildAccountList(accounts)}\n\n` +
  `Transaction to categorize:\n` +
  `- Description: ${txn.description}\n` +
  `- Amount: ${txn.amount.toFixed(2)}\n` +
  `- Date: ${txn.date}\n\n` +
  `Pick the debit account and the credit account that record this transaction ` +
  `as a balanced double-entry, using only account ids from the list above. ` +
  `Give a confidence from 0 to 1 and a one-sentence rationale.`;

/**
 * Validate the model's raw suggestion against the book's accounts. Returns a
 * typed suggestion or null when the model picked an unknown account, named the
 * same account twice, or returned a malformed confidence (never trust the model
 * to have stayed inside the provided chart)
 */
export const validateSuggestion = (
  raw: unknown,
  accounts: SuggestAccount[],
): CategorySuggestion | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const debitAccountId =
    typeof r.debitAccountId === "string" ? r.debitAccountId : null;
  const creditAccountId =
    typeof r.creditAccountId === "string" ? r.creditAccountId : null;
  const rationale = typeof r.rationale === "string" ? r.rationale : "";
  const confidenceRaw = Number(r.confidence);

  if (!debitAccountId || !creditAccountId) return null;
  if (debitAccountId === creditAccountId) return null;

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const debit = byId.get(debitAccountId);
  const credit = byId.get(creditAccountId);
  if (!debit || !credit) return null;

  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0;

  return {
    debitAccountId,
    debitAccountName: debit.name,
    creditAccountId,
    creditAccountName: credit.name,
    confidence,
    rationale: rationale.trim(),
  };
};

// =============================================================================
// Orchestrator
// =============================================================================

const SYSTEM_PROMPT =
  "You are an expert bookkeeper. You categorize transactions into a " +
  "double-entry ledger by choosing the correct debit and credit accounts from " +
  "the provided chart of accounts. You never invent account ids.";

/**
 * Suggest a categorization for a transaction using Claude. Returns null when AI
 * is not configured or the model's answer does not validate against the book's
 * chart of accounts. Reads are book-scoped by the caller's bookAccess check
 */
export const suggestCategory = async (
  bookId: string,
  txn: SuggestTransaction,
): Promise<CategorySuggestion | null> => {
  if (!client) return null;

  const accounts = await dbPool
    .select({
      id: accountTable.id,
      code: accountTable.code,
      name: accountTable.name,
      type: accountTable.type,
      subType: accountTable.subType,
    })
    .from(accountTable)
    .where(
      and(eq(accountTable.bookId, bookId), eq(accountTable.isActive, true)),
    );

  if (accounts.length === 0) return null;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "categorize_transaction",
        description:
          "Record the chosen debit and credit accounts for the transaction.",
        input_schema: {
          type: "object",
          properties: {
            debitAccountId: {
              type: "string",
              description: "Account id to debit (from the provided chart)",
            },
            creditAccountId: {
              type: "string",
              description: "Account id to credit (from the provided chart)",
            },
            confidence: {
              type: "number",
              description: "Confidence from 0 to 1",
            },
            rationale: {
              type: "string",
              description: "One-sentence explanation",
            },
          },
          required: [
            "debitAccountId",
            "creditAccountId",
            "confidence",
            "rationale",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "categorize_transaction" },
    messages: [{ role: "user", content: buildPrompt(accounts, txn) }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  return validateSuggestion(toolUse.input, accounts);
};
