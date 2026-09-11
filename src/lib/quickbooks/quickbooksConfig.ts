import {
  QBO_CLIENT_ID,
  QBO_CLIENT_SECRET,
  QBO_ENV,
  QBO_REDIRECT_URI,
} from "lib/config/env.config";

/** Intuit OAuth 2.0 authorization endpoint */
export const QBO_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";

/** Intuit OAuth 2.0 token endpoint */
export const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

/** Intuit OAuth 2.0 token-revoke endpoint */
export const QBO_REVOKE_URL =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

interface QuickbooksEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  env?: string;
}

interface QuickbooksConfig {
  isConfigured: boolean;
  baseUrl: string;
}

/**
 * Resolve QuickBooks configuration from env inputs.
 * Pure helper so the config can be evaluated with different inputs
 * @param env - QuickBooks credentials and environment selector
 */
export const resolveQuickbooksConfig = ({
  clientId,
  clientSecret,
  redirectUri,
  env,
}: QuickbooksEnv): QuickbooksConfig => ({
  isConfigured: Boolean(clientId && clientSecret && redirectUri),
  // Fail safe toward sandbox for financial data: only an explicit "production" hits the live API
  baseUrl:
    env === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com",
});

const config = resolveQuickbooksConfig({
  clientId: QBO_CLIENT_ID,
  clientSecret: QBO_CLIENT_SECRET,
  redirectUri: QBO_REDIRECT_URI,
  env: QBO_ENV,
});

/** Whether QuickBooks migration credentials are configured */
export const isQuickbooksConfigured = config.isConfigured;

/** QuickBooks API base URL for the configured environment */
export const quickbooksBaseUrl = config.baseUrl;

if (!isQuickbooksConfigured) {
  console.warn(
    "QBO_CLIENT_ID/QBO_CLIENT_SECRET/QBO_REDIRECT_URI not set, QuickBooks migration disabled",
  );
}
