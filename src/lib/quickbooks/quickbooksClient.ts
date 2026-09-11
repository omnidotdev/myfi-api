import {
  QBO_CLIENT_ID,
  QBO_CLIENT_SECRET,
  QBO_REDIRECT_URI,
} from "lib/config/env.config";
import { QBO_TOKEN_URL, quickbooksBaseUrl } from "./quickbooksConfig";

/** Default QBO query page size (STARTPOSITION/MAXRESULTS window) */
export const PAGE_SIZE = 1000;

/** A stored QuickBooks connection with its current OAuth tokens */
export interface QboConnection {
  realmId: string;
  accessToken: string;
  refreshToken: string;
}

/** New tokens produced by an OAuth exchange or refresh */
export interface QboTokens {
  accessToken: string;
  refreshToken: string;
}

/** Callback invoked with rotated tokens so the caller can persist them */
type OnRefresh = (tokens: QboTokens) => Promise<void>;

/** Minimal shape of a QBO journal entry needed by downstream migration tasks */
export interface QboJournalEntry {
  Id: string;
  TxnDate: string;
  PrivateNote?: string;
  Line: Array<{
    Amount: number;
    DetailType?: string;
    Description?: string;
    JournalEntryLineDetail?: {
      PostingType: "Debit" | "Credit";
      AccountRef: { value: string; name?: string };
    };
  }>;
}

/** Minimal shape of a QBO chart-of-accounts entry */
export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AcctNum?: string;
  Classification?: string;
}

interface QboTokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface QboQueryResponse<T> {
  QueryResponse?: Record<string, T[] | undefined>;
}

/** HTTP Basic auth header from the configured client credentials */
const basicAuthHeader = (): string => {
  const encoded = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString(
    "base64",
  );
  return `Basic ${encoded}`;
};

/** POST to the Intuit token endpoint with the given grant params */
const postToken = async (
  params: Record<string, string>,
): Promise<QboTokenResponse> => {
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    // Surface status only, never the response body (may echo credentials)
    throw new Error(`QuickBooks token request failed: ${res.status}`);
  }

  return res.json() as Promise<QboTokenResponse>;
};

/**
 * Exchange an OAuth authorization code for tokens.
 * QBO returns the realmId as a separate callback query param, not in the token
 * body, so the caller passes it through here
 * @param code - Authorization code from the OAuth callback
 * @param realmId - Intuit company (realm) id from the OAuth callback
 */
export const exchangeCode = async (
  code: string,
  realmId: string,
): Promise<QboTokens & { realmId: string }> => {
  const tokens = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: QBO_REDIRECT_URI ?? "",
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? "",
    realmId,
  };
};

/**
 * Refresh an access token using a stored refresh token.
 * QBO may rotate the refresh token, so return whatever it gives and fall back
 * to the existing refresh token when the response omits one
 * @param refreshToken - Currently stored refresh token
 */
export const refreshAccessToken = async (
  refreshToken: string,
): Promise<QboTokens> => {
  const tokens = await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
  };
};

/** Perform a single authed GET against the company API */
const rawGet = (realmId: string, path: string, accessToken: string) =>
  fetch(`${quickbooksBaseUrl}/v3/company/${realmId}/${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

/**
 * Low-level authed GET against the QBO company API.
 * On a 401 it refreshes once, hands the new tokens to onRefresh, retries once,
 * then throws. On a 429 it throws a clear rate-limit error. Errors carry the
 * status and path only, never tokens or the response body
 * @param conn - Connection with realmId and current tokens
 * @param path - Company-API path after the realm segment
 * @param onRefresh - Called with rotated tokens so the caller can persist them
 */
export const qboGet = async (
  conn: QboConnection,
  path: string,
  onRefresh: OnRefresh,
): Promise<unknown> => {
  let res = await rawGet(conn.realmId, path, conn.accessToken);

  if (res.status === 429) {
    throw new Error(`QuickBooks rate limit hit: 429 ${path}`);
  }

  if (res.status === 401) {
    const tokens = await refreshAccessToken(conn.refreshToken);
    await onRefresh(tokens);
    res = await rawGet(conn.realmId, path, tokens.accessToken);

    if (res.status === 429) {
      throw new Error(`QuickBooks rate limit hit: 429 ${path}`);
    }
  }

  if (!res.ok) {
    throw new Error(`QuickBooks API error: ${res.status} ${path}`);
  }

  return res.json();
};

/** Run a QBO SQL-like query and return the named collection from QueryResponse */
const runQuery = async <T>(
  conn: QboConnection,
  query: string,
  collection: string,
  onRefresh: OnRefresh,
): Promise<T[]> => {
  const path = `query?query=${encodeURIComponent(query)}`;
  const body = (await qboGet(conn, path, onRefresh)) as QboQueryResponse<T>;
  return body.QueryResponse?.[collection] ?? [];
};

/**
 * Query JournalEntry rows in a date range, paginating by STARTPOSITION until a
 * page returns fewer than PAGE_SIZE rows.
 * @param conn - Connection with realmId and current tokens
 * @param opts - Inclusive TxnDate range and the token-refresh callback
 */
export const queryJournalEntries = async (
  conn: QboConnection,
  opts: { start: string; end: string; onRefresh: OnRefresh },
): Promise<QboJournalEntry[]> => {
  const all: QboJournalEntry[] = [];
  let startPosition = 1;

  while (true) {
    const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${opts.start}' AND TxnDate <= '${opts.end}' STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`;
    const page = await runQuery<QboJournalEntry>(
      conn,
      query,
      "JournalEntry",
      opts.onRefresh,
    );

    all.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    startPosition += PAGE_SIZE;
  }

  return all;
};

/**
 * Query the chart of accounts.
 * @param conn - Connection with realmId and current tokens
 * @param onRefresh - Called with rotated tokens so the caller can persist them
 */
export const queryAccounts = async (
  conn: QboConnection,
  onRefresh: OnRefresh,
): Promise<QboAccount[]> =>
  runQuery<QboAccount>(conn, "SELECT * FROM Account", "Account", onRefresh);
