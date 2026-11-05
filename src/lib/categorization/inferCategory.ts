import { createSynapseClient } from "@omnidotdev/providers/ai";

import { SYNAPSE_API_KEY, SYNAPSE_BASE_URL } from "lib/ai/synapse";

/** Result returned by LLM inference */
interface InferenceResult {
  debitAccountId: string;
  creditAccountId: string;
  confidence: number;
  reasoning: string;
}

interface AccountInfo {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface InferCategoryInput {
  merchantName: string | null;
  memo: string | null;
  amount: number;
  isIncome: boolean;
  bookType: string;
  accounts: AccountInfo[];
}

// Provider-prefixed model id (the Synapse gateway routes by it). Haiku by
// default for high-volume categorization; override via env
const MODEL =
  process.env.MYFI_INFER_MODEL ?? "anthropic/claude-haiku-4-5-20251001";

// Route through the Synapse gateway (central metering/billing/abuse guard), not
// a direct provider call. Null when Synapse is not configured, which disables
// LLM inference (categorization falls back to deterministic rules upstream)
const client =
  SYNAPSE_BASE_URL && SYNAPSE_API_KEY
    ? createSynapseClient({
        baseUrl: SYNAPSE_BASE_URL,
        apiKey: SYNAPSE_API_KEY,
        model: MODEL,
      })
    : null;

/**
 * Use LLM inference to categorize a transaction.
 * Returns suggested debit/credit accounts with confidence, or null on failure.
 * @param input - Transaction details and available accounts
 */
const inferCategory = async (
  input: InferCategoryInput,
): Promise<InferenceResult | null> => {
  if (!client) return null;

  const accountList = input.accounts
    .map((a) => `${a.code ?? "N/A"} | ${a.name} (${a.type})`)
    .join("\n");

  const prompt = `You are a bookkeeping assistant. Categorize this transaction by selecting the best debit and credit accounts from the chart of accounts below.

Transaction:
- Merchant: ${input.merchantName ?? "Unknown"}
- Description: ${input.memo ?? "N/A"}
- Amount: ${input.amount}
- Is income: ${input.isIncome}
- Book type: ${input.bookType}

Chart of Accounts:
${accountList}

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "debitAccountCode": "<code of debit account>",
  "creditAccountCode": "<code of credit account>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>"
}`;

  try {
    const { text } = await client.messages({
      system: "",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 256,
    });

    if (!text) return null;

    const parsed = JSON.parse(text) as {
      debitAccountCode: string;
      creditAccountCode: string;
      confidence: number;
      reasoning: string;
    };

    // Resolve account codes to IDs
    const debitAccount = input.accounts.find(
      (a) => a.code === parsed.debitAccountCode,
    );
    const creditAccount = input.accounts.find(
      (a) => a.code === parsed.creditAccountCode,
    );

    if (!debitAccount || !creditAccount) return null;

    return {
      debitAccountId: debitAccount.id,
      creditAccountId: creditAccount.id,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    console.warn("LLM inference error:", err);
    return null;
  }
};

export default inferCategory;
