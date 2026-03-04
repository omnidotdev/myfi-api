import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

import {
  PLAID_CLIENT_ID,
  PLAID_ENV,
  PLAID_SECRET,
} from "lib/config/env.config";

const config = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

// Plaid API client configured from environment
const plaidClient = new PlaidApi(config);

export default plaidClient;
