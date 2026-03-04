import { Elysia, t } from "elysia";

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

// Vortex webhook endpoint for receiving Mantle events
const mantleWebhook = new Elysia({ prefix: "/api/webhooks" }).post(
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
