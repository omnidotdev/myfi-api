import Anthropic from "@anthropic-ai/sdk";

/**
 * Synapse is the Omni AI gateway: it holds provider keys and enforces budgets,
 * rate limits, and usage metering (billed via Aether). All of myfi's LLM traffic
 * routes through it rather than calling a provider directly, so AI spend is
 * centrally metered, billed, and abuse-guarded like every other fleet product.
 *
 * Both envs must be set for AI categorization to run; otherwise it is disabled
 * (categorization degrades to deterministic rules). The key is a managed Synapse
 * key, never a raw provider key, and model ids are provider-prefixed (the
 * gateway routes by them, e.g. anthropic/claude-haiku-4-5-20251001)
 */

/** Synapse gateway base URL (root; clients append `/v1/messages`). */
export const SYNAPSE_BASE_URL = process.env.SYNAPSE_BASE_URL;

/** Managed Synapse key authorizing gateway calls. */
export const SYNAPSE_API_KEY = process.env.SYNAPSE_API_KEY;

if (!SYNAPSE_BASE_URL || !SYNAPSE_API_KEY) {
  console.warn(
    "SYNAPSE_BASE_URL/SYNAPSE_API_KEY not set, AI categorization disabled",
  );
}

/**
 * Anthropic SDK pointed at the Synapse gateway, for the tool-use categorization
 * path (forced `tool_choice`, which the plain-text client does not support). It
 * posts to `{baseURL}/v1/messages` with the Synapse key, so it is metered like
 * every other gateway call. Null when Synapse is not configured
 */
export const synapseAnthropic: Anthropic | null =
  SYNAPSE_BASE_URL && SYNAPSE_API_KEY
    ? new Anthropic({ apiKey: SYNAPSE_API_KEY, baseURL: SYNAPSE_BASE_URL })
    : null;
