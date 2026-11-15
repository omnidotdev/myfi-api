import { describe, expect, test } from "bun:test";

import { gatewayAnthropic } from "./suggestCategory";

describe("gatewayAnthropic", () => {
  test("sends the product key as a Bearer token, never x-api-key", async () => {
    // The Synapse gateway authenticates only `Authorization: Bearer`; the
    // SDK's default `x-api-key` header is refused with a 401
    let seen: Headers | undefined;
    const fetchStub = (async (_url: string, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-haiku-5-5",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const client = gatewayAnthropic(
      "synapse_test",
      "https://gateway.example.com",
      fetchStub,
    );
    await client.messages.create({
      model: "auto",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(seen?.get("authorization")).toBe("Bearer synapse_test");
    expect(seen?.get("x-api-key")).toBeNull();
  });
});
