import {
  QBO_CLIENT_ID,
  QBO_CLIENT_SECRET,
  QBO_REDIRECT_URI,
} from "lib/config/env.config";
import {
  QBO_REVOKE_URL,
  QBO_TOKEN_URL,
  quickbooksBaseUrl,
} from "./quickbooksConfig";

/** Default QBO query page size (STARTPOSITION/MAXRESULTS window) */
export const PAGE_SIZE = 1000;

/** Hard cap on pagination iterations, a safety net against an unbounded loop */
const MAX_PAGES = 1000;

/** QBO query dates must be plain ISO calendar dates, guarding against query injection */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  CurrencyRef?: { value?: string };
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

/** Minimal shape of the QBO company Preferences needed by the migration */
interface QboPreferences {
  CurrencyPrefs?: {
    MultiCurrencyEnabled?: boolean;
  };
}

/** A single account's balance parsed from a QBO report */
export type QboReportAccountBalance = {
  qboAccountId: string | null;
  accountName: string;
  debit: number;
  credit: number;
};

/** A single cell of a report row */
interface QboReportColData {
  value?: string;
  id?: string;
}

/** A row in a QBO report, either a Data account row or a nesting Section */
interface QboReportRow {
  type?: string;
  ColData?: QboReportColData[];
  Rows?: { Row?: QboReportRow[] };
}

/** A column definition in a QBO report header */
interface QboReportColumn {
  ColTitle?: string;
  ColType?: string;
}

/** Minimal shape of a QBO report response (TrialBalance and friends) */
interface QboReport {
  Columns?: { Column?: QboReportColumn[] };
  Rows?: { Row?: QboReportRow[] };
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

  if (!tokens.access_token || !tokens.refresh_token) {
    // An initial auth-code exchange always returns both tokens, so a missing one
    // means the exchange is broken. Storing an empty refresh token would silently
    // break every future refresh, so fail loudly instead (never echo the body)
    throw new Error("QuickBooks token exchange returned incomplete tokens");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
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

/**
 * Best-effort revoke of a refresh token at Intuit.
 * Resolves on success, throws only on a non-ok response. The error carries the
 * status only, never the token or the response body
 * @param refreshToken - Refresh token to revoke
 */
export const revokeToken = async (refreshToken: string): Promise<void> => {
  const res = await fetch(QBO_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ token: refreshToken }),
  });

  if (!res.ok) {
    // Surface status only, never the token or response body
    throw new Error(`QuickBooks token revoke failed: ${res.status}`);
  }
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
    // TODO(phase-2): add bounded backoff and retry on 429
    throw new Error(`QuickBooks rate limit hit: 429 ${path}`);
  }

  if (res.status === 401) {
    const tokens = await refreshAccessToken(conn.refreshToken);
    await onRefresh(tokens);
    res = await rawGet(conn.realmId, path, tokens.accessToken);

    if (res.status === 429) {
      // TODO(phase-2): add bounded backoff and retry on 429
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
  // Dates are interpolated into the QBO query, so reject anything that is not a
  // plain ISO calendar date before it reaches the query string
  for (const [field, value] of [
    ["start", opts.start],
    ["end", opts.end],
  ] as const) {
    if (!ISO_DATE.test(value)) {
      throw new Error(`Invalid QuickBooks query date for ${field}`);
    }
  }

  const all: QboJournalEntry[] = [];
  let startPosition = 1;

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${opts.start}' AND TxnDate <= '${opts.end}' STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`;
    const rows = await runQuery<QboJournalEntry>(
      conn,
      query,
      "JournalEntry",
      opts.onRefresh,
    );

    all.push(...rows);

    if (rows.length < PAGE_SIZE) {
      return all;
    }
    startPosition += PAGE_SIZE;
  }

  throw new Error(
    "QuickBooks journal entry query exceeded max pagination pages",
  );
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

/**
 * Query the company Preferences.
 * QBO returns a single Preferences object, so the first row is returned (or
 * undefined when the collection is absent). Used to detect multi-currency
 * companies up front, before any journal entry is imported
 * @param conn - Connection with realmId and current tokens
 * @param onRefresh - Called with rotated tokens so the caller can persist them
 */
export const queryPreferences = async (
  conn: QboConnection,
  onRefresh: OnRefresh,
): Promise<QboPreferences | undefined> => {
  const rows = await runQuery<QboPreferences>(
    conn,
    "SELECT * FROM Preferences",
    "Preferences",
    onRefresh,
  );
  return rows[0];
};

/** Coerce a report cell value into a number, treating blanks/junk as 0 */
const safeNum = (value: string | undefined): number => {
  if (value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Resolve the Debit and Credit column indices from the report header.
 * QBO returns the debit/credit columns by title, and reading them by fixed
 * position would silently swap the two if Intuit ever reordered or inserted a
 * column, corrupting every reconciliation variance with no error. So key off
 * the header and fail loudly when a column cannot be located
 */
const resolveBalanceColumnIndices = (
  columns: QboReportColumn[] | undefined,
): { debitIdx: number; creditIdx: number } => {
  let debitIdx = -1;
  let creditIdx = -1;

  for (let i = 0; i < (columns?.length ?? 0); i++) {
    const title = columns?.[i]?.ColTitle?.trim().toLowerCase();
    if (title === "debit") {
      debitIdx = i;
    } else if (title === "credit") {
      creditIdx = i;
    }
  }

  if (debitIdx === -1 || creditIdx === -1) {
    throw new Error(
      "QuickBooks trial balance report is missing Debit/Credit columns",
    );
  }

  return { debitIdx, creditIdx };
};

/**
 * Walk a report row tree, emitting one balance per Data account row.
 * Section headers and Summary/TOTAL rows are skipped, and nested Rows.Row are
 * traversed recursively. Debit and credit are read from the header-resolved
 * column indices, not fixed positions. This never throws on shape variance
 */
const collectReportBalances = (
  rows: QboReportRow[] | undefined,
  indices: { debitIdx: number; creditIdx: number },
  out: QboReportAccountBalance[],
): void => {
  if (!rows) {
    return;
  }
  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      out.push({
        qboAccountId: cols[0]?.id ?? null,
        accountName: cols[0]?.value ?? "",
        debit: safeNum(cols[indices.debitIdx]?.value),
        credit: safeNum(cols[indices.creditIdx]?.value),
      });
    }
    // A Data row never nests, but a Section (or an untyped wrapper) can, so
    // always descend into any child rows
    collectReportBalances(row.Rows?.Row, indices, out);
  }
};

/**
 * Fetch and parse the QBO TrialBalance report for a date range.
 * Uses the Reports API (not the query endpoint) and flattens the nested report
 * into one balance per account, skipping section and summary rows
 * @param conn - Connection with realmId and current tokens
 * @param opts - Inclusive report date range and the token-refresh callback
 */
export const queryTrialBalanceReport = async (
  conn: QboConnection,
  opts: { start: string; end: string; onRefresh: OnRefresh },
): Promise<QboReportAccountBalance[]> => {
  // Dates are interpolated into the report URL, so reject anything that is not
  // a plain ISO calendar date before it reaches the query string
  for (const [field, value] of [
    ["start", opts.start],
    ["end", opts.end],
  ] as const) {
    if (!ISO_DATE.test(value)) {
      throw new Error(`Invalid QuickBooks query date for ${field}`);
    }
  }

  const report = (await qboGet(
    conn,
    `reports/TrialBalance?start_date=${opts.start}&end_date=${opts.end}`,
    opts.onRefresh,
  )) as QboReport;

  const rows = report.Rows?.Row;
  if (!rows || rows.length === 0) {
    return [];
  }

  // Resolve the Debit/Credit indices from the header before walking, so a
  // reordered or inserted column can never silently swap the two
  const indices = resolveBalanceColumnIndices(report.Columns?.Column);

  const balances: QboReportAccountBalance[] = [];
  collectReportBalances(rows, indices, balances);
  return balances;
};
