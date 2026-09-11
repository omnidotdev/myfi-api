import { describe, expect, test } from "bun:test";

import {
  QBO_AUTHORIZE_URL,
  QBO_TOKEN_URL,
  isQuickbooksConfigured,
  quickbooksBaseUrl,
  resolveQuickbooksConfig,
} from "./quickbooksConfig";

describe("resolveQuickbooksConfig", () => {
  test("isConfigured is false when credentials are unset", () => {
    const config = resolveQuickbooksConfig({});

    expect(config.isConfigured).toBe(false);
  });

  test("isConfigured is false when only some credentials are set", () => {
    const config = resolveQuickbooksConfig({
      clientId: "id",
      clientSecret: "secret",
    });

    expect(config.isConfigured).toBe(false);
  });

  test("isConfigured is true when all credentials are set", () => {
    const config = resolveQuickbooksConfig({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://example.com/callback",
    });

    expect(config.isConfigured).toBe(true);
  });

  test("baseUrl resolves to sandbox host when env is sandbox", () => {
    const config = resolveQuickbooksConfig({ env: "sandbox" });

    expect(config.baseUrl).toBe("https://sandbox-quickbooks.api.intuit.com");
  });

  test("baseUrl resolves to production host only when env is production", () => {
    const config = resolveQuickbooksConfig({ env: "production" });

    expect(config.baseUrl).toBe("https://quickbooks.api.intuit.com");
  });

  test("baseUrl fails safe to sandbox for unset, empty, or unknown env", () => {
    // Anything other than an explicit "production" must degrade toward sandbox
    for (const env of [undefined, "", "prod", "PRODUCTION", "staging"]) {
      const config = resolveQuickbooksConfig({ env });

      expect(config.baseUrl).toBe("https://sandbox-quickbooks.api.intuit.com");
    }
  });
});

describe("quickbooksConfig module", () => {
  test("isQuickbooksConfigured is false when env vars are unset", () => {
    // QBO_* env vars are not set in the test environment
    expect(isQuickbooksConfigured).toBe(false);
  });

  test("quickbooksBaseUrl defaults to the sandbox host", () => {
    expect(quickbooksBaseUrl).toBe("https://sandbox-quickbooks.api.intuit.com");
  });

  test("exposes the Intuit OAuth endpoints", () => {
    expect(QBO_AUTHORIZE_URL).toBe(
      "https://appcenter.intuit.com/connect/oauth2",
    );
    expect(QBO_TOKEN_URL).toBe(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    );
  });
});
