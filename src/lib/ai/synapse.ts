import { createSynapseProvisioner } from "@omnidotdev/providers/ai";

/**
 * Synapse is the Omni AI gateway: it holds provider keys and enforces
 * entitlements, the included AI allowance, metering, and billing (via Aether).
 * All of myfi's LLM traffic routes through it rather than calling a provider
 * directly.
 *
 * Every call uses a product-scoped managed key: provisioned per user under the
 * `myfi` Aether app and billed to the workspace (organization) that owns the
 * book. There is no shared/static key: when provisioning is not configured or
 * fails, AI categorization is unavailable and deterministic rules apply.
 *
 * All three envs must be set for AI categorization to run. Model ids are
 * provider-prefixed (the gateway routes by them, e.g.
 * anthropic/claude-haiku-4-5-20251001)
 */

/** Aether app id the gateway meters and enforces myfi's AI allowance under. */
const MYFI_APP_ID = "myfi";

/** Synapse gateway base URL (root; clients append `/v1/messages`). */
export const SYNAPSE_BASE_URL = process.env.SYNAPSE_BASE_URL;

/** Synapse provisioning API base URL (api.synapse, not the gateway). */
const SYNAPSE_API_URL = process.env.SYNAPSE_API_URL;

/** Fleet gateway secret authorizing managed-key provisioning. */
const SYNAPSE_GATEWAY_SECRET = process.env.SYNAPSE_GATEWAY_SECRET;

if (!SYNAPSE_BASE_URL || !SYNAPSE_API_URL || !SYNAPSE_GATEWAY_SECRET) {
  console.warn(
    "SYNAPSE_BASE_URL/SYNAPSE_API_URL/SYNAPSE_GATEWAY_SECRET not set, AI categorization disabled",
  );
}

/**
 * Product-scoped managed-key provisioner (keys cached per user and billing
 * entity). Null when provisioning is not configured
 */
export const synapseProvisioner =
  SYNAPSE_API_URL && SYNAPSE_GATEWAY_SECRET
    ? createSynapseProvisioner({
        apiUrl: SYNAPSE_API_URL,
        gatewaySecret: SYNAPSE_GATEWAY_SECRET,
        source: "MyFi",
        appId: MYFI_APP_ID,
      })
    : null;
