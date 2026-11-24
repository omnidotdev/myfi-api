import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia } from "elysia";
import { TypeCompiler, t } from "elysia/type-system";

import { MANTLE_WEBHOOK_SECRET, isDevEnv } from "lib/config/env.config";
import handleMantleEvent from "./eventHandlers";

import type { WebhookResult } from "./eventHandlers";

// Optional string field that also accepts `null`: Mantle emits nullable
// columns (e.g. an unpaid invoice's `paidAt`) as JSON null, not as absent keys
const optionalString = () => t.Optional(t.Nullable(t.String()));

// Decimal amounts arrive as strings (Postgres numeric) or numbers
const optionalAmount = () =>
  t.Optional(t.Nullable(t.Union([t.String(), t.Number()])));

const mantleWebhookBody = t.Object({
  event: t.String(),
  data: t.Object({
    // Legacy format fields
    organizationId: optionalString(),
    referenceId: optionalString(),
    amount: optionalAmount(),
    currency: optionalString(),
    memo: optionalString(),
    metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Unknown()))),
    // Mantle native format fields
    id: optionalString(),
    companyId: optionalString(),
    contactId: optionalString(),
    invoiceNumber: optionalString(),
    status: optionalString(),
    total: optionalAmount(),
    issueDate: optionalString(),
    dueDate: optionalString(),
    paidAt: optionalString(),
    paymentReference: optionalString(),
    // Payment and credit fields
    invoiceId: optionalString(),
    paymentId: optionalString(),
    kind: optionalString(),
    reference: optionalString(),
    method: optionalString(),
    // Quote fields
    quoteNumber: optionalString(),
    validUntil: optionalString(),
    convertedInvoiceId: optionalString(),
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

/**
 * Drop `null` fields so a nullable Mantle column reads as absent downstream,
 * matching how the handlers treat a missing value.
 * @param data - Event data as delivered.
 * @returns The data without its `null` fields.
 */
const dropNullFields = <T extends Record<string, unknown>>(
  data: T,
): { [K in keyof T]?: Exclude<T[K], null> } =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null),
  ) as { [K in keyof T]?: Exclude<T[K], null> };

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

const mantleWebhookBodyValidator = TypeCompiler.Compile(mantleWebhookBody);

// Vortex webhook endpoint for receiving Mantle events. The signature is
// verified over the exact bytes Vortex signed before anything is parsed or
// validated, so the body is captured as raw text by the parse hook below and
// parsed by hand. Reading it any later fails: the book access middleware's
// global hook has already consumed the stream ("Body is disturbed or locked"),
// which answered every delivery with a 500
const mantleWebhook = new Elysia({ prefix: "/api/webhooks" }).post(
  "/mantle",
  async ({ body: rawBodyText, request, set }) => {
    const rawBody = typeof rawBodyText === "string" ? rawBodyText : "";

    const auth = authorizeMantleWebhook({
      isDev: isDevEnv,
      secret: MANTLE_WEBHOOK_SECRET,
      signature: request.headers.get("X-Webhook-Signature"),
      rawBody,
    });

    if (!auth.authorized) {
      set.status = auth.status;
      return { error: auth.error };
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      set.status = 400;
      return { error: "Invalid JSON" };
    }

    if (!mantleWebhookBodyValidator.Check(body)) {
      set.status = 422;
      return { error: "Invalid webhook payload" };
    }

    const result = await handleMantleEvent({
      event: body.event,
      data: dropNullFields(body.data),
    });

    // Map the outcome to an HTTP status so Vortex retries transient failures
    // instead of acking a lost event (default 200)
    set.status = webhookStatusForResult(result);

    return result;
  },
  {
    // Capture the body as raw text, once, so the signature check sees the
    // exact signed bytes
    parse: ({ request }) => request.text(),
  },
);

export default mantleWebhook;
