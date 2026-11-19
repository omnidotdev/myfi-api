import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia, t } from "elysia";

import { deleteOrganizationBooks } from "lib/books/deleteBooks";
import { IDP_WEBHOOK_SECRET } from "lib/config/env.config";

import type { DeleteBooksDeps } from "lib/books/deleteBooks";

/** Constant-time check of a hex HMAC-SHA256 signature over the raw body */
const verifySignature = (
  rawBody: string,
  signature: string,
  secret: string,
): boolean => {
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

interface IdpWebhookDeps extends DeleteBooksDeps {
  /**
   * Shared secret Vortex signs identity events with, defaults to
   * IDP_WEBHOOK_SECRET. When unset every request is refused (fail closed)
   */
  webhookSecret?: string;
}

/**
 * `POST /webhooks/idp`: Gatekeeper identity events, delivered by Vortex as
 * HMAC-signed webhooks (`x-idp-signature`, hex HMAC-SHA256 of the raw body).
 *
 * Handles `organization.deleted`: every book the deleted workspace holds is
 * deleted with all of its data, after its bank and payroll connections are
 * revoked and its stored files deleted (see books/deleteBooks). The books are
 * the workspace's own records, kept on its behalf, so they go with it. Other
 * events are acked without effect.
 *
 * No secret is a 503, a missing or bad signature a 401, an unreadable body or
 * a missing organization id a 400, and a failed deletion a 500 so Vortex
 * retries it (the deletion is idempotent)
 */
export const createIdpWebhook = ({
  webhookSecret = IDP_WEBHOOK_SECRET,
  ...deps
}: IdpWebhookDeps = {}) =>
  new Elysia({ name: "idp-webhook" }).post(
    "/webhooks/idp",
    async ({ body, headers, set }) => {
      // The raw text the parse hook below captured; the request stream itself
      // is already consumed when a global hook (book access) reads the body
      const rawBody = typeof body === "string" ? body : "";
      const signature = headers["x-idp-signature"];

      if (!webhookSecret) {
        console.warn(
          "IDP_WEBHOOK_SECRET not set, rejecting unverifiable IDP webhook",
        );
        set.status = 503;
        return { error: "Webhook secret not configured" };
      }
      if (!signature) {
        set.status = 401;
        return { error: "Missing signature" };
      }
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        set.status = 401;
        return { error: "Invalid signature" };
      }

      let event: { eventType?: unknown; organizationId?: unknown };
      try {
        event = JSON.parse(rawBody);
      } catch {
        set.status = 400;
        return { error: "Invalid JSON" };
      }

      if (event.eventType !== "organization.deleted") {
        console.warn(
          `[IDP Webhook] Unhandled event type: ${String(event.eventType)}`,
        );
        return { received: true };
      }

      const { organizationId } = event;
      if (typeof organizationId !== "string" || !organizationId) {
        set.status = 400;
        return { error: "Missing organizationId" };
      }

      try {
        const result = await deleteOrganizationBooks(organizationId, deps);
        // biome-ignore lint/suspicious/noConsole: webhook observability
        console.log(
          `[IDP Webhook] organization.deleted for ${organizationId}: deleted ${result.deletedBookIds.length} books (${result.plaidItems} bank items, ${result.payrollTokens} payroll tokens, ${result.files} files released)`,
        );
      } catch (err) {
        console.error(
          `[IDP Webhook] organization.deleted for ${organizationId} failed`,
          err,
        );
        set.status = 500;
        return { error: "Internal Server Error" };
      }

      return { received: true };
    },
    {
      headers: t.Object({
        "x-idp-signature": t.Optional(t.String()),
        "x-idp-event": t.Optional(t.String()),
      }),
      // Capture the body as raw text, once, so the signature check sees the
      // exact signed bytes
      parse: ({ request }) => request.text(),
    },
  );

const idpWebhook = createIdpWebhook();

export default idpWebhook;
