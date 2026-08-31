import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import { authorizeMantleWebhook, verifySignature } from "./mantleWebhook";

const SECRET = "test-webhook-secret";
const RAW_BODY = JSON.stringify({
  event: "invoice.paid",
  data: { id: "inv-1" },
});

/** Compute a valid HMAC-SHA256 hex signature for the given body. */
const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("hex");

describe("authorizeMantleWebhook", () => {
  test("fails closed when the secret is unset in a prod-like env", () => {
    const result = authorizeMantleWebhook({
      isDev: false,
      secret: undefined,
      signature: null,
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(false);
    expect(result).toMatchObject({ status: 401 });
  });

  test("rejects even when a signature is supplied but no secret is configured", () => {
    const result = authorizeMantleWebhook({
      isDev: false,
      secret: undefined,
      signature: "deadbeef",
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(false);
    expect(result).toMatchObject({ status: 401 });
  });

  test("accepts a valid signature when the secret is set", () => {
    const result = authorizeMantleWebhook({
      isDev: false,
      secret: SECRET,
      signature: sign(RAW_BODY, SECRET),
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(true);
  });

  test("rejects a missing signature when the secret is set", () => {
    const result = authorizeMantleWebhook({
      isDev: false,
      secret: SECRET,
      signature: null,
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(false);
    expect(result).toMatchObject({ status: 401 });
  });

  test("rejects an invalid signature when the secret is set", () => {
    const result = authorizeMantleWebhook({
      isDev: false,
      secret: SECRET,
      signature: sign(RAW_BODY, "wrong-secret"),
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(false);
    expect(result).toMatchObject({ status: 401 });
  });

  test("bypasses verification only in local dev mode", () => {
    const result = authorizeMantleWebhook({
      isDev: true,
      secret: undefined,
      signature: null,
      rawBody: RAW_BODY,
    });

    expect(result.authorized).toBe(true);
  });
});

describe("verifySignature", () => {
  test("returns true for a matching signature", () => {
    expect(verifySignature(RAW_BODY, sign(RAW_BODY, SECRET), SECRET)).toBe(
      true,
    );
  });

  test("returns false for a tampered body", () => {
    expect(
      verifySignature(`${RAW_BODY} `, sign(RAW_BODY, SECRET), SECRET),
    ).toBe(false);
  });
});
