import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";

import { Elysia } from "elysia";

const SECRET = "route-test-secret";

mock.module("lib/config/env.config", () => ({
  MANTLE_WEBHOOK_SECRET: SECRET,
  isDevEnv: false,
}));

const received: unknown[] = [];

mock.module("./eventHandlers", () => ({
  default: async (body: unknown) => {
    received.push(body);
    return { success: true };
  },
}));

const { default: mantleWebhook } = await import("./mantleWebhook");

const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("hex");

const post = (
  body: string,
  signature: string | null = sign(body),
  app: { handle: (request: Request) => Promise<Response> } = mantleWebhook,
) =>
  app.handle(
    new Request("http://localhost/api/webhooks/mantle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-webhook-signature": signature } : {}),
      },
      body,
    }),
  );

/**
 * Body exactly as Vortex delivers it: the CloudEvent `type` and `data` reshaped
 * to `{ event, data }`, with Mantle's nullable columns serialized as null
 */
const invoiceDelivery = JSON.stringify({
  event: "mantle.invoice.updated",
  data: {
    id: "inv-1",
    organizationId: "org-1",
    companyId: null,
    contactId: null,
    invoiceNumber: "INV-0001",
    status: "sent",
    total: "125.50",
    currency: "USD",
    issueDate: "2026-11-01",
    dueDate: null,
    paidAt: null,
    paymentReference: null,
  },
});

const paymentDelivery = JSON.stringify({
  event: "mantle.payment.created",
  data: {
    id: "pay-1",
    invoiceId: "inv-1",
    organizationId: "org-1",
    currency: "USD",
    amount: "50.00",
    paidAt: "2026-11-02T10:00:00.000Z",
    reference: null,
    method: "bank_transfer",
  },
});

beforeEach(() => {
  received.length = 0;
});

describe("POST /api/webhooks/mantle", () => {
  test("accepts a signed Vortex delivery and drops null fields", async () => {
    const res = await post(invoiceDelivery);

    expect(res.status).toBe(200);
    expect(received).toHaveLength(1);

    const { event, data } = received[0] as {
      event: string;
      data: Record<string, unknown>;
    };

    expect(event).toBe("mantle.invoice.updated");
    expect(data).toMatchObject({ id: "inv-1", total: "125.50" });
    expect("paidAt" in data).toBe(false);
  });

  test("still reads the signed body when a global hook has already parsed it", async () => {
    // The server's book access middleware reads every request's body in a
    // global hook, which consumes the stream before this route runs
    const app = new Elysia()
      .onBeforeHandle({ as: "global" }, ({ body }) => {
        void body;
      })
      .use(mantleWebhook);

    const res = await post(invoiceDelivery, sign(invoiceDelivery), app);

    expect(res.status).toBe(200);
    expect(received).toHaveLength(1);
  });

  test("accepts a payment event with a string decimal amount", async () => {
    const res = await post(paymentDelivery);

    expect(res.status).toBe(200);
    expect(received[0]).toMatchObject({
      data: { id: "pay-1", amount: "50.00" },
    });
  });

  test("rejects a missing signature without handling the event", async () => {
    const res = await post(invoiceDelivery, null);

    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  test("rejects a signature made with another secret", async () => {
    const res = await post(invoiceDelivery, sign(invoiceDelivery, "other"));

    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  test("rejects a body altered after signing", async () => {
    const res = await post(
      invoiceDelivery.replace("125.50", "999.00"),
      sign(invoiceDelivery),
    );

    expect(res.status).toBe(401);
    expect(received).toHaveLength(0);
  });

  test("rejects signed malformed JSON as a bad request", async () => {
    const body = "{not json";
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(received).toHaveLength(0);
  });

  test("rejects a signed body that does not match the event shape", async () => {
    const body = JSON.stringify({ event: "mantle.invoice.updated" });
    const res = await post(body);

    expect(res.status).toBe(422);
    expect(received).toHaveLength(0);
  });
});
