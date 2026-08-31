import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia, t } from "elysia";

import { MANTLE_WEBHOOK_SECRET, isDevEnv } from "lib/config/env.config";
import handleMantleEvent from "./eventHandlers";

import type { WebhookResult } from "./eventHandlers";

const mantleWebhookBody = t.Object({
  event: t.String(),
  data: t.Object({
    // Legacy format fields
    organizationId: t.Optional(t.String()),
    referenceId: t.Optional(t.String()),
    amount: t.Optional(t.Number()),
    currency: t.Optional(t.String()),
    memo: t.Optional(t.String()),
    metadata: t.Optional(t.Record(t.String(), t.Unknown())),
    // Mantle native format fields
    id: t.Optional(t.String()),
    companyId: t.Optional(t.String()),
    contactId: t.Optional(t.String()),
    invoiceNumber: t.Optional(t.String()),
    status: t.Optional(t.String()),
    total: t.Optional(t.Union([t.String(), t.Number()])),
    issueDate: t.Optional(t.String()),
    dueDate: t.Optional(t.String()),
    paidAt: t.Optional(t.String()),
    paymentReference: t.Optional(t.String()),
    // Quote fields
    quoteNumber: t.Optional(t.String()),
    convertedInvoiceId: t.Optional(t.String()),
  }),
});

/**
 * Verify HMAC-SHA256 webhook signature.
 * @param rawBody - Raw request body string.
 * @param signature - Value of the `X-Webhook-Signature` header.
 * @param secret - Shared webhook signing secret.
 * @returns Whether the signature is valid.
 */
export const verifySignature = (
  rawBody: string,
  signature: string,
  secret: string,
): boolean => {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
};

/** Result of an authorization decision for an incoming Mantle webhook. */
type MantleAuthResult =
  | { authorized: true }
  | { authorized: false; status: number; error: string };

/**
 * Decide whether an incoming Mantle webhook request is authorized.
 *
 * Fails closed: local dev is the only bypass. In every other environment the
 * signing secret MUST be configured; when it is unset the caller cannot be
 * authenticated, so the request is rejected rather than accepted unverified.
 * @param isDev - Whether the process is running in local dev mode.
 * @param secret - Configured webhook signing secret, if any.
 * @param signature - Value of the `X-Webhook-Signature` header, if present.
 * @param rawBody - Raw request body string.
 */
export const authorizeMantleWebhook = ({
  isDev,
  secret,
  signature,
  rawBody,
}: {
  isDev: boolean;
  secret: string | undefined;
  signature: string | null;
  rawBody: string;
}): MantleAuthResult => {
  // Local dev is the only legitimate bypass, gated strictly on a
  // non-production NODE_ENV
  if (isDev) return { authorized: true };

  // Fail closed: outside dev the secret MUST be configured. Without it the
  // caller cannot be authenticated, so reject rather than accept unverified
  // journal entries. Log the misconfiguration server-side only
  if (!secret) {
    console.error("MANTLE_WEBHOOK_SECRET not set, rejecting webhook request");

    return {
      authorized: false,
      status: 401,
      error: "Invalid webhook signature",
    };
  }

  if (!signature) {
    return {
      authorized: false,
      status: 401,
      error: "Missing webhook signature",
    };
  }

  if (!verifySignature(rawBody, signature, secret)) {
    return {
      authorized: false,
      status: 401,
      error: "Invalid webhook signature",
    };
  }

  return { authorized: true };
};

/**
 * Map a handler result to the HTTP status returned to Vortex.
 *
 * The handler reports outcomes in its result shape rather than throwing, so
 * without this mapping every outcome returns a default 200: Vortex acks and
 * never redelivers, permanently losing an event that failed only because its
 * config was not yet in place. Transient failures (`retryable`) return 503 so
 * Vortex retries; terminal failures and duplicates return 200 so a genuinely
 * unprocessable or already-processed event is not retried forever.
 * @param result - Result returned by `handleMantleEvent`.
 * @returns HTTP status code to respond with.
 */
export const webhookStatusForResult = (result: WebhookResult): number =>
  result.retryable ? 503 : 200;

// Vortex webhook endpoint for receiving Mantle events
const mantleWebhook = new Elysia({ prefix: "/api/webhooks" })
  .onBeforeHandle(async ({ request, set }) => {
    const signature = request.headers.get("X-Webhook-Signature");
    // Clone the request to read the raw body without consuming it
    const rawBody = await request.clone().text();

    const result = authorizeMantleWebhook({
      isDev: isDevEnv,
      secret: MANTLE_WEBHOOK_SECRET,
      signature,
      rawBody,
    });

    if (!result.authorized) {
      set.status = result.status;
      return { error: result.error };
    }
  })
  .post(
    "/mantle",
    async ({ body, set }) => {
      const result = await handleMantleEvent(body);

      // Map the outcome to an HTTP status so Vortex retries transient failures
      // instead of acking a lost event (default 200)
      set.status = webhookStatusForResult(result);

      return result;
    },
    {
      body: mantleWebhookBody,
    },
  );

export default mantleWebhook;
