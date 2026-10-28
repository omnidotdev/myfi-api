import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: (t: string) => `dec(${t})`,
}));

// Spread the real env so unrelated exports stay intact, overriding only the
// Gusto OAuth credentials the revoke call needs
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  GUSTO_CLIENT_ID: "client-id",
  GUSTO_CLIENT_SECRET: "client-secret",
}));

const { revokeGustoToken } = await import("./revokeGustoToken");

const originalFetch = global.fetch;
const mockFetch = mock(async () => new Response(null, { status: 200 }));

describe("revokeGustoToken", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockImplementation(
      async () => new Response(null, { status: 200 }),
    );
    global.fetch = mockFetch as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("posts the decrypted token to Gusto's revoke endpoint", async () => {
    const ok = await revokeGustoToken("enc-token");
    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.gusto.com/oauth/revoke");
    const body = JSON.parse(init.body as string);
    expect(body.token).toBe("dec(enc-token)");
    expect(body.client_id).toBe("client-id");
  });

  test("returns false without throwing when Gusto rejects", async () => {
    mockFetch.mockImplementation(
      async () => new Response(null, { status: 401 }),
    );
    expect(await revokeGustoToken("enc-token")).toBe(false);
  });

  test("returns false when the network call throws", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("network");
    });
    expect(await revokeGustoToken("enc-token")).toBe(false);
  });
});
