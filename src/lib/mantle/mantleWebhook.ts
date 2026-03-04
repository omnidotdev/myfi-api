import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia, t } from "elysia";

import { MANTLE_WEBHOOK_SECRET, isDevEnv } from "lib/config/env.config";
import handleMantleEvent from "./eventHandlers";

const mantleWebhookBody = t.Object({
  event: t.String(),
  data: t.Object({
    organizationId: t.String(),
    referenceId: t.String(),
    amount: t.Number(),
    currency: t.Optional(t.String()),
    memo: t.Optional(t.String()),
    metadata: t.Optional(t.Record(t.String(), t.Unknown())),
  }),
});

/**
 * Verify HMAC-SHA256 webhook signature.
 * @param rawBody - Raw request body string.
 * @param signature - Value of the `X-Webhook-Signature` header.
 * @returns Whether the signature is valid.
 */
const verifySignature = (rawBody: string, signature: string): boolean => {
  if (!MANTLE_WEBHOOK_SECRET) return false;

  const expected = createHmac("sha256", MANTLE_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
};

// Vortex webhook endpoint for receiving Mantle events
const mantleWebhook = new Elysia({ prefix: "/api/webhooks" })
  .onBeforeHandle(async ({ request, set }) => {
    // Skip verification in dev mode or when secret is not configured
    if (isDevEnv || !MANTLE_WEBHOOK_SECRET) return;

    const signature = request.headers.get("X-Webhook-Signature");

    if (!signature) {
      set.status = 401;
      return { error: "Missing webhook signature" };
    }

    // Clone the request to read the raw body without consuming it
    const rawBody = await request.clone().text();

    if (!verifySignature(rawBody, signature)) {
      set.status = 401;
      return { error: "Invalid webhook signature" };
    }
  })
  .post(
    "/mantle",
    async ({ body }) => {
      const result = await handleMantleEvent(body);

      return result;
    },
    {
      body: mantleWebhookBody,
    },
  );

export default mantleWebhook;
