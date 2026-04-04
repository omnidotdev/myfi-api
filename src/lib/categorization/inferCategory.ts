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

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Use LLM inference to categorize a transaction.
 * Returns suggested debit/credit accounts with confidence, or null on failure.
 * @param input - Transaction details and available accounts
 */
const inferCategory = async (
  input: InferCategoryInput,
): Promise<InferenceResult | null> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set, LLM categorization disabled");
    return null;
  }

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
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn(`LLM inference failed with status ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const text = data.content?.[0]?.text;
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
