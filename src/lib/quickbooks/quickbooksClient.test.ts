import { beforeEach, describe, expect, mock, test } from "bun:test";

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

import type {
  QboAccount,
  QboConnection,
  QboJournalEntry,
  QboReportAccountBalance,
  QboTokens,
} from "./quickbooksClient";

// Query param forces a fresh, unmocked module instance, bypassing the
// mock.module registered for "./quickbooksClient" by backfill.test.ts
// @ts-expect-error -- query-param import has no type declarations
const client = await import("./quickbooksClient.ts?real");
const {
  PAGE_SIZE,
  exchangeCode,
  qboGet,
  queryAccounts,
  queryJournalEntries,
  queryPreferences,
  queryTrialBalanceReport,
  refreshAccessToken,
  revokeToken,
} = client;

// The client builds Basic auth from whatever env.config resolved. QBO creds are
// unset in the test environment, so assert against those same resolved values
// rather than hardcoded strings, keeping the test independent of load order
const expectedBasic = `${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`;
const expectedRedirectUri = QBO_REDIRECT_URI ?? "";

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[] = [];
let responses: Response[] = [];

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockFetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), init: init ?? {} });
  const next = responses.shift();
  if (!next) {
    throw new Error("mockFetch: no queued response");
  }
  return Promise.resolve(next);
});

const decodeBasic = (header: string): string => {
  const encoded = header.replace(/^Basic /, "");
  return Buffer.from(encoded, "base64").toString("utf8");
};

const conn: QboConnection = {
  realmId: "realm-1",
  accessToken: "access-1",
  refreshToken: "refresh-1",
};

beforeEach(() => {
  calls = [];
  responses = [];
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

describe("exchangeCode", () => {
  test("POSTs an authorization_code grant with Basic auth and returns tokens plus realmId", async () => {
    responses = [jsonResponse({ access_token: "acc", refresh_token: "ref" })];

    const result = await exchangeCode("auth-code-123", "realm-xyz");

    expect(result).toEqual({
      accessToken: "acc",
      refreshToken: "ref",
      realmId: "realm-xyz",
    });

    const [call] = calls;
    expect(call.url).toBe(QBO_TOKEN_URL);
    expect(call.init.method).toBe("POST");

    const headers = new Headers(call.init.headers);
    expect(decodeBasic(headers.get("Authorization") ?? "")).toBe(expectedBasic);
    expect(headers.get("Content-Type")).toBe(
      "application/x-www-form-urlencoded",
    );

    const body = new URLSearchParams(String(call.init.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-123");
    expect(body.get("redirect_uri")).toBe(expectedRedirectUri);
  });

  test("throws without leaking the response body on a token error", async () => {
    responses = [
      jsonResponse({ error: "invalid_grant", secret: "leak-me" }, 400),
    ];

    let message = "";
    try {
      await exchangeCode("bad-code", "realm-xyz");
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain("400");
    expect(message).not.toContain("leak-me");
  });

  test("throws when the exchange response is missing a token, never echoing it", async () => {
    // An initial auth-code exchange must yield both tokens
    responses = [jsonResponse({ access_token: "acc-only" })];

    let message = "";
    try {
      await exchangeCode("auth-code-123", "realm-xyz");
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain("acc-only");
  });

  test("throws when the exchange response omits the access token", async () => {
    responses = [jsonResponse({ refresh_token: "ref-only" })];

    let message = "";
    try {
      await exchangeCode("auth-code-123", "realm-xyz");
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain("ref-only");
  });
});

describe("refreshAccessToken", () => {
  test("POSTs a refresh_token grant and returns rotated tokens", async () => {
    responses = [
      jsonResponse({ access_token: "acc-2", refresh_token: "ref-2" }),
    ];

    const result = await refreshAccessToken("refresh-1");

    expect(result).toEqual({ accessToken: "acc-2", refreshToken: "ref-2" });

    const [call] = calls;
    expect(call.url).toBe(QBO_TOKEN_URL);
    const headers = new Headers(call.init.headers);
    expect(decodeBasic(headers.get("Authorization") ?? "")).toBe(expectedBasic);
    const body = new URLSearchParams(String(call.init.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-1");
  });

  test("falls back to the old refresh token when the response omits one", async () => {
    responses = [jsonResponse({ access_token: "acc-2" })];

    const result = await refreshAccessToken("refresh-1");

    expect(result).toEqual({ accessToken: "acc-2", refreshToken: "refresh-1" });
  });
});

describe("revokeToken", () => {
  test("POSTs the refresh token to the revoke endpoint with Basic auth and a JSON body", async () => {
    responses = [jsonResponse({}, 200)];

    await revokeToken("refresh-to-revoke");

    const [call] = calls;
    expect(call.url).toBe(QBO_REVOKE_URL);
    expect(call.init.method).toBe("POST");

    const headers = new Headers(call.init.headers);
    expect(decodeBasic(headers.get("Authorization") ?? "")).toBe(expectedBasic);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");

    expect(JSON.parse(String(call.init.body))).toEqual({
      token: "refresh-to-revoke",
    });
  });

  test("throws on a non-ok response without leaking the token or the response body", async () => {
    responses = [
      jsonResponse({ error: "invalid_token", secret: "leak-me" }, 400),
    ];

    let message = "";
    try {
      await revokeToken("refresh-to-revoke");
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain("400");
    expect(message).not.toContain("refresh-to-revoke");
    expect(message).not.toContain("leak-me");
  });
});

describe("qboGet", () => {
  test("issues an authed GET against the company API and returns json", async () => {
    responses = [jsonResponse({ ok: true })];
    const onRefresh = mock(() => Promise.resolve());

    const result = await qboGet(conn, "companyinfo/realm-1", onRefresh);

    expect(result).toEqual({ ok: true });
    const [call] = calls;
    expect(call.url).toBe(
      `${quickbooksBaseUrl}/v3/company/realm-1/companyinfo/realm-1`,
    );
    expect(call.init.method ?? "GET").toBe("GET");
    const headers = new Headers(call.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
    expect(headers.get("Accept")).toBe("application/json");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test("refreshes once on 401, retries with the new token, and reports the rotation", async () => {
    responses = [
      jsonResponse({ error: "expired" }, 401),
      jsonResponse({ access_token: "acc-9", refresh_token: "ref-9" }),
      jsonResponse({ ok: "after-refresh" }),
    ];
    const onRefresh = mock((_tokens: QboTokens) => Promise.resolve());

    const result = await qboGet(conn, "account/1", onRefresh);

    expect(result).toEqual({ ok: "after-refresh" });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh.mock.calls[0]?.[0]).toEqual({
      accessToken: "acc-9",
      refreshToken: "ref-9",
    });

    // First GET, then token refresh, then retried GET with the new token
    expect(calls).toHaveLength(3);
    const retryHeaders = new Headers(calls[2]?.init.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer acc-9");
  });

  test("throws when the retry after refresh still fails", async () => {
    responses = [
      jsonResponse({ error: "expired" }, 401),
      jsonResponse({ access_token: "acc-9", refresh_token: "ref-9" }),
      jsonResponse({ error: "still bad" }, 500),
    ];
    const onRefresh = mock(() => Promise.resolve());

    let message = "";
    try {
      await qboGet(conn, "account/1", onRefresh);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("500");
    expect(message).toContain("account/1");
  });

  test("throws a rate-limit error on 429 without leaking tokens or body", async () => {
    responses = [jsonResponse({ error: "throttled", secret: "leak-me" }, 429)];
    const onRefresh = mock(() => Promise.resolve());

    let message = "";
    try {
      await qboGet(conn, "account/1", onRefresh);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message.toLowerCase()).toContain("rate limit");
    expect(message).toContain("429");
    expect(message).not.toContain("leak-me");
    expect(message).not.toContain("access-1");
    expect(message).not.toContain("Bearer");
  });

  test("throws immediately on a non-401 error without refreshing", async () => {
    responses = [jsonResponse({ error: "boom" }, 500)];
    const onRefresh = mock(() => Promise.resolve());

    await expect(qboGet(conn, "account/1", onRefresh)).rejects.toThrow();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});

describe("queryJournalEntries", () => {
  test("paginates by STARTPOSITION and concatenates rows until a short page", async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({
      Id: `je-${i}`,
      TxnDate: "2026-01-01",
      Line: [],
    }));
    const shortPage = [
      { Id: "je-last", TxnDate: "2026-01-02", Line: [] },
      { Id: "je-last-2", TxnDate: "2026-01-03", Line: [] },
    ];

    responses = [
      jsonResponse({ QueryResponse: { JournalEntry: fullPage } }),
      jsonResponse({ QueryResponse: { JournalEntry: shortPage } }),
    ];
    const onRefresh = mock(() => Promise.resolve());

    const rows: QboJournalEntry[] = await queryJournalEntries(conn, {
      start: "2026-01-01",
      end: "2026-12-31",
      onRefresh,
    });

    expect(rows).toHaveLength(PAGE_SIZE + 2);
    expect(rows.at(-1)?.Id).toBe("je-last-2");
    expect(calls).toHaveLength(2);

    const firstQuery = decodeURIComponent(
      new URL(calls[0]?.url ?? "").searchParams.get("query") ?? "",
    );
    expect(firstQuery).toContain("SELECT * FROM JournalEntry");
    expect(firstQuery).toContain("TxnDate >= '2026-01-01'");
    expect(firstQuery).toContain("TxnDate <= '2026-12-31'");
    expect(firstQuery).toContain("STARTPOSITION 1");
    expect(firstQuery).toContain(`MAXRESULTS ${PAGE_SIZE}`);

    const secondQuery = decodeURIComponent(
      new URL(calls[1]?.url ?? "").searchParams.get("query") ?? "",
    );
    expect(secondQuery).toContain(`STARTPOSITION ${PAGE_SIZE + 1}`);
  });

  test("returns an empty array when a page has no JournalEntry key", async () => {
    responses = [jsonResponse({ QueryResponse: {} })];
    const onRefresh = mock(() => Promise.resolve());

    const rows = await queryJournalEntries(conn, {
      start: "2026-01-01",
      end: "2026-12-31",
      onRefresh,
    });

    expect(rows).toEqual([]);
  });

  test("throws a bounded pagination error instead of looping forever on always-full pages", async () => {
    const fullPageBody = JSON.stringify({
      QueryResponse: {
        JournalEntry: Array.from({ length: PAGE_SIZE }, (_, i) => ({
          Id: `je-${i}`,
          TxnDate: "2026-01-01",
          Line: [],
        })),
      },
    });
    // Ignore the response queue and always hand back a full page
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(fullPageBody, { status: 200 })),
    ) as unknown as typeof fetch;
    const onRefresh = mock(() => Promise.resolve());

    await expect(
      queryJournalEntries(conn, {
        start: "2026-01-01",
        end: "2026-12-31",
        onRefresh,
      }),
    ).rejects.toThrow(/max pagination pages/i);
  });

  test("rejects a non-ISO date to guard against query injection, without echoing it", async () => {
    const onRefresh = mock(() => Promise.resolve());

    let message = "";
    try {
      await queryJournalEntries(conn, {
        start: "2026-01-01'; DROP",
        end: "2026-12-31",
        onRefresh,
      });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message.toLowerCase()).toContain("date");
    expect(message).toContain("start");
    expect(message).not.toContain("DROP");
    // Validation must fail before any request goes out
    expect(calls).toHaveLength(0);
  });

  test("rejects a malformed end date", async () => {
    const onRefresh = mock(() => Promise.resolve());

    await expect(
      queryJournalEntries(conn, {
        start: "2026-01-01",
        end: "not-a-date",
        onRefresh,
      }),
    ).rejects.toThrow(/date/i);
    expect(calls).toHaveLength(0);
  });
});

describe("queryAccounts", () => {
  test("runs SELECT * FROM Account and returns the rows", async () => {
    responses = [
      jsonResponse({
        QueryResponse: {
          Account: [
            { Id: "1", Name: "Checking", AccountType: "Bank" },
            { Id: "2", Name: "Sales", AccountType: "Income" },
          ],
        },
      }),
    ];
    const onRefresh = mock(() => Promise.resolve());

    const accounts: QboAccount[] = await queryAccounts(conn, onRefresh);

    expect(accounts).toHaveLength(2);
    expect(accounts[0]?.Name).toBe("Checking");
    const query = decodeURIComponent(
      new URL(calls[0]?.url ?? "").searchParams.get("query") ?? "",
    );
    expect(query).toContain("SELECT * FROM Account");
  });

  test("returns an empty array when there are no accounts", async () => {
    responses = [jsonResponse({ QueryResponse: {} })];
    const onRefresh = mock(() => Promise.resolve());

    const accounts = await queryAccounts(conn, onRefresh);

    expect(accounts).toEqual([]);
  });
});

describe("queryPreferences", () => {
  test("runs SELECT * FROM Preferences and returns the first row", async () => {
    responses = [
      jsonResponse({
        QueryResponse: {
          Preferences: [{ CurrencyPrefs: { MultiCurrencyEnabled: true } }],
        },
      }),
    ];
    const onRefresh = mock(() => Promise.resolve());

    const preferences = await queryPreferences(conn, onRefresh);

    expect(preferences?.CurrencyPrefs?.MultiCurrencyEnabled).toBe(true);
    const query = decodeURIComponent(
      new URL(calls[0]?.url ?? "").searchParams.get("query") ?? "",
    );
    expect(query).toContain("SELECT * FROM Preferences");
  });

  test("returns undefined when there is no Preferences row", async () => {
    responses = [jsonResponse({ QueryResponse: {} })];
    const onRefresh = mock(() => Promise.resolve());

    const preferences = await queryPreferences(conn, onRefresh);

    expect(preferences).toBeUndefined();
  });
});

describe("queryTrialBalanceReport", () => {
  // A realistic nested TrialBalance report: an "Assets" section holding two
  // Data rows (one with an id on ColData[0], one without) plus a section-level
  // Summary row, then a top-level TOTAL summary row. Only the two Data rows are
  // real accounts, everything else must be skipped
  const nestedReport = {
    Header: { ReportName: "TrialBalance" },
    Columns: {
      Column: [{ ColTitle: "" }, { ColTitle: "Debit" }, { ColTitle: "Credit" }],
    },
    Rows: {
      Row: [
        {
          Header: { ColData: [{ value: "Assets" }] },
          Rows: {
            Row: [
              {
                type: "Data",
                ColData: [
                  { value: "Checking", id: "101" },
                  { value: "1,250.75" },
                  { value: "" },
                ],
              },
              {
                type: "Data",
                ColData: [
                  { value: "Undeposited Funds" },
                  { value: "" },
                  { value: "300" },
                ],
              },
            ],
          },
          Summary: {
            ColData: [
              { value: "Total Assets" },
              { value: "1250.75" },
              { value: "300" },
            ],
          },
          type: "Section",
        },
        {
          type: "Section",
          Summary: {
            ColData: [
              { value: "TOTAL" },
              { value: "1250.75" },
              { value: "300" },
            ],
          },
        },
      ],
    },
  };

  test("returns only Data rows, skipping section and summary rows, in order", async () => {
    responses = [jsonResponse(nestedReport)];
    const onRefresh = mock(() => Promise.resolve());

    const balances: QboReportAccountBalance[] = await queryTrialBalanceReport(
      conn,
      { start: "2026-01-01", end: "2026-12-31", onRefresh },
    );

    expect(balances).toEqual([
      {
        qboAccountId: "101",
        accountName: "Checking",
        debit: 1250.75,
        credit: 0,
      },
      {
        qboAccountId: null,
        accountName: "Undeposited Funds",
        debit: 0,
        credit: 300,
      },
    ]);
  });

  test("reads debit/credit by column header, not position, when columns are swapped", async () => {
    // Columns ordered [Account, Credit, Debit] instead of the usual
    // [Account, Debit, Credit], with the ColData cells following that same
    // order. A position-based parser would swap debit and credit, so keying off
    // the header must still land each amount in the correct field
    const swappedReport = {
      Header: { ReportName: "TrialBalance" },
      Columns: {
        Column: [
          { ColTitle: "", ColType: "Account" },
          { ColTitle: "Credit", ColType: "Money" },
          { ColTitle: "Debit", ColType: "Money" },
        ],
      },
      Rows: {
        Row: [
          {
            type: "Data",
            ColData: [
              { value: "Checking", id: "101" },
              { value: "" },
              { value: "1,250.75" },
            ],
          },
          {
            type: "Data",
            ColData: [
              { value: "Sales", id: "202" },
              { value: "500" },
              { value: "" },
            ],
          },
        ],
      },
    };
    responses = [jsonResponse(swappedReport)];
    const onRefresh = mock(() => Promise.resolve());

    const balances: QboReportAccountBalance[] = await queryTrialBalanceReport(
      conn,
      { start: "2026-01-01", end: "2026-12-31", onRefresh },
    );

    expect(balances).toEqual([
      {
        qboAccountId: "101",
        accountName: "Checking",
        debit: 1250.75,
        credit: 0,
      },
      { qboAccountId: "202", accountName: "Sales", debit: 0, credit: 500 },
    ]);
  });

  test("throws when the report is missing a Debit or Credit column", async () => {
    const missingDebit = {
      Header: { ReportName: "TrialBalance" },
      Columns: {
        Column: [{ ColTitle: "", ColType: "Account" }, { ColTitle: "Credit" }],
      },
      Rows: {
        Row: [
          {
            type: "Data",
            ColData: [{ value: "Checking", id: "101" }, { value: "300" }],
          },
        ],
      },
    };
    responses = [jsonResponse(missingDebit)];
    const onRefresh = mock(() => Promise.resolve());

    await expect(
      queryTrialBalanceReport(conn, {
        start: "2026-01-01",
        end: "2026-12-31",
        onRefresh,
      }),
    ).rejects.toThrow(/debit\/credit columns/i);
  });

  test("hits the Reports API path with the date range", async () => {
    responses = [jsonResponse(nestedReport)];
    const onRefresh = mock(() => Promise.resolve());

    await queryTrialBalanceReport(conn, {
      start: "2026-01-01",
      end: "2026-12-31",
      onRefresh,
    });

    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe(`/v3/company/realm-1/reports/TrialBalance`);
    expect(url.searchParams.get("start_date")).toBe("2026-01-01");
    expect(url.searchParams.get("end_date")).toBe("2026-12-31");
  });

  test("rejects a non-ISO start date without issuing a request or echoing it", async () => {
    const onRefresh = mock(() => Promise.resolve());

    let message = "";
    try {
      await queryTrialBalanceReport(conn, {
        start: "2026-01-01'; DROP",
        end: "2026-12-31",
        onRefresh,
      });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message.toLowerCase()).toContain("date");
    expect(message).toContain("start");
    expect(message).not.toContain("DROP");
    expect(calls).toHaveLength(0);
  });

  test("rejects a malformed end date without issuing a request", async () => {
    const onRefresh = mock(() => Promise.resolve());

    await expect(
      queryTrialBalanceReport(conn, {
        start: "2026-01-01",
        end: "not-a-date",
        onRefresh,
      }),
    ).rejects.toThrow(/date/i);
    expect(calls).toHaveLength(0);
  });

  test("returns an empty array when the report has no Rows", async () => {
    responses = [
      jsonResponse({ Header: { ReportName: "TrialBalance" }, Columns: {} }),
    ];
    const onRefresh = mock(() => Promise.resolve());

    const balances = await queryTrialBalanceReport(conn, {
      start: "2026-01-01",
      end: "2026-12-31",
      onRefresh,
    });

    expect(balances).toEqual([]);
  });

  test("returns an empty array when Rows has no Row array", async () => {
    responses = [jsonResponse({ Rows: {} })];
    const onRefresh = mock(() => Promise.resolve());

    const balances = await queryTrialBalanceReport(conn, {
      start: "2026-01-01",
      end: "2026-12-31",
      onRefresh,
    });

    expect(balances).toEqual([]);
  });
});
