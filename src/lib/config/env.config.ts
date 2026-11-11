/**
 * Environment variables.
 */
export const {
  NODE_ENV,
  PORT = 4000,
  DATABASE_URL,
  CORS_ALLOWED_ORIGINS,
  AUTH_JWKS_URL,
  GRAPHQL_MAX_COMPLEXITY_COST = "5000",
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_ENV = "sandbox",
  TOKEN_ENCRYPTION_KEY,
  MANTLE_WEBHOOK_SECRET,
  GUSTO_CLIENT_ID,
  GUSTO_CLIENT_SECRET,
  GUSTO_REDIRECT_URI,
  VORTEX_API_URL,
  VORTEX_API_KEY,
  HERALD_API_URL,
  HERALD_API_KEY,
  NOTIFICATION_FROM_EMAIL,
  // Shared secret for the manual system-job trigger endpoints (e.g. monthly
  // close). Scheduled runs happen in-process; these HTTP triggers are ops-only
  INTERNAL_JOB_TOKEN,
} = process.env;

export const isDevEnv = NODE_ENV === "development",
  isProdEnv = NODE_ENV === "production";

/**
 * Required environment variables. Without any of these the service boots but
 * fails later at the first operation that needs them (e.g. an undefined
 * DATABASE_URL silently falls back to libpq defaults, and a missing
 * TOKEN_ENCRYPTION_KEY only throws on the first token encrypt/decrypt)
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "AUTH_JWKS_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

/**
 * Optional integration env groups. Each is all-or-nothing: when a group is not
 * fully configured the feature degrades gracefully and a warning is logged, but
 * the service still boots
 */
const OPTIONAL_INTEGRATIONS: ReadonlyArray<{
  vars: readonly string[];
  feature: string;
}> = [
  { vars: ["PLAID_CLIENT_ID", "PLAID_SECRET"], feature: "bank sync (Plaid)" },
  {
    vars: ["GUSTO_CLIENT_ID", "GUSTO_CLIENT_SECRET"],
    feature: "payroll (Gusto)",
  },
  {
    vars: ["SYNAPSE_BASE_URL", "SYNAPSE_API_KEY"],
    feature: "AI categorization (Synapse)",
  },
];

/**
 * Thrown at boot when a required environment variable is missing or malformed.
 * The message names only the offending variable(s), never their values, so a
 * secret can never leak into logs
 */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Assert the required environment is present and well-formed, and warn for any
 * optional integration that is not fully configured. Call once at boot so a
 * misconfigured deploy fails loudly at startup instead of 500ing later.
 * @param env - Environment source (defaults to process.env)
 * @param warn - Warning sink (defaults to console.warn)
 * @throws EnvValidationError when a required var is missing or malformed
 */
export const validateEnv = (
  env: Record<string, string | undefined> = process.env,
  warn: (message: string) => void = console.warn,
): void => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new EnvValidationError(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // Validate the key shape at boot so a malformed key fails here rather than on
  // the first token operation. Only the length/charset is checked, never logged
  const key = env.TOKEN_ENCRYPTION_KEY;
  if (key && !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new EnvValidationError(
      "TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) key",
    );
  }

  for (const { vars, feature } of OPTIONAL_INTEGRATIONS) {
    const allSet = vars.every((name) => env[name]);

    if (!allSet) {
      warn(`${vars.join("/")} not set, ${feature} disabled`);
    }
  }
};
