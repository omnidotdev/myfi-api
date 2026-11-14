import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";

import bookAi from "lib/ai/bookAi";
import { SYNAPSE_BASE_URL, synapseProvisioner } from "lib/ai/synapse";
import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

import type { BookAiOutcome } from "lib/ai/bookAi";

// Provider-prefixed model id (the Synapse gateway routes by it). Default to a
// capable model; override to a cheaper one for high-volume categorization
const MODEL =
  process.env.MYFI_CATEGORIZATION_MODEL ?? "anthropic/claude-opus-4-6";

/**
 * Anthropic SDK pointed at the Synapse gateway with a product-scoped key, for
 * the tool-use path (forced `tool_choice`, which the plain-text client does not
 * support). It posts to `{baseURL}/v1/messages`, so the gateway enforces the
 * workspace's included AI allowance and meters it like every other call
 * @param apiKey - Product-scoped key billed to the book's workspace
 * @param baseURL - Synapse gateway base URL
 */
const gatewayAnthropic = (apiKey: string, baseURL: string) =>
  new Anthropic({ apiKey, baseURL });

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
 * Suggest a categorization for a transaction using Claude, billed to the book's
 * workspace under its included AI allowance. Returns `allowance_used` when the
 * gateway refuses with 402 and `unavailable` when AI is not configured or the
 * gateway fails; an `ok` value is null when the model's answer does not
 * validate against the book's chart of accounts. Reads are book-scoped by the
 * caller's bookAccess check
 * @param bookId - Book the transaction belongs to
 * @param txn - Transaction to categorize
 * @param actorId - Requesting user's identity-provider id (the key holder)
 */
export const suggestCategory = async (
  bookId: string,
  txn: SuggestTransaction,
  actorId: string,
): Promise<BookAiOutcome<CategorySuggestion | null>> => {
  const baseURL = SYNAPSE_BASE_URL;
  if (!baseURL || !synapseProvisioner) return { status: "unavailable" };

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

  if (accounts.length === 0) return { status: "ok", value: null };

  return bookAi.run(
    { bookId, actorId, mode: "interactive" },
    async (apiKey) => {
      const client = gatewayAnthropic(apiKey, baseURL);
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
    },
  );
};
