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
} = process.env;

export const isDevEnv = NODE_ENV === "development",
  isProdEnv = NODE_ENV === "production";
