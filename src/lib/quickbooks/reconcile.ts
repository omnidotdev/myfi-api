import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  connectedAccountTable,
  quickbooksAccountMapTable,
  quickbooksReconciliationLineTable,
  quickbooksReconciliationTable,
} from "lib/db/schema";
import { decryptToken, encryptToken } from "lib/encryption/tokenEncryption";
import generateTrialBalance from "lib/reports/trialBalance";
import { queryTrialBalanceReport } from "./quickbooksClient";

import type { QboConnection, QboTokens } from "./quickbooksClient";

/**
 * Below this absolute variance a line is treated as matched, not a mismatch.
 * Guards against float and rounding noise between the two ledgers being
 * reported as real discrepancies
 */
const MISMATCH_TOLERANCE = 0.005;

/**
 * Normalize a stored timestamp (or plain date) to a YYYY-MM-DD UTC calendar
 * date, which is the only shape the QBO report client accepts
 */
const toIsoDate = (value: string): string =>
  new Date(value).toISOString().slice(0, 10);

/**
 * Format a money amount as a fixed 4-decimal string, collapsing negative zero
 * (a rounded-down tiny negative) to a plain zero
 */
const money = (value: number): string => {
  const fixed = value.toFixed(4);
  return fixed === "-0.0000" ? "0.0000" : fixed;
};

/** A reconciliation line row before it is written */
interface ReconLine {
  reconciliationId: string;
  bookId: string;
  myfiAccountId: string | null;
  qboAccountId: string | null;
  accountName: string;
  qboBalance: string;
  myfiBalance: string;
  variance: string;
}

/**
 * Reconcile a book's trial balance against a connected QuickBooks company.
 *
 * Fetches QBO's TrialBalance and MyFi's own trial balance for the run's period,
 * nets each account (debit minus credit), pairs them through the QBO->MyFi
 * account map, and writes one variance line per account (mapped pairs, then
 * QBO-only and MyFi-only leftovers with no double counting). Aggregates the
 * absolute variance and a mismatch count onto the run row. On any failure the
 * run is marked failed with a generic message (never a token, secret, or raw
 * QBO body) and the error is rethrown for the caller to log
 */
export const runReconciliation = async (opts: {
  reconciliationId: string;
  bookId: string;
  connectedAccountId: string;
}): Promise<{ totalVariance: string; mismatchCount: number }> => {
  const { reconciliationId, bookId, connectedAccountId } = opts;

  try {
    const [account] = await dbPool
      .select()
      .from(connectedAccountTable)
      .where(eq(connectedAccountTable.id, connectedAccountId));

    if (!account?.accessToken || !account.refreshToken || !account.realmId) {
      throw new Error("Connected account is missing QuickBooks credentials");
    }

    // Defense-in-depth against a cross-tenant read: the connected account must
    // belong to the book being reconciled. The route enforces this too, but
    // runReconciliation must be safe regardless of how it is called
    if (account.bookId !== bookId) {
      throw new Error("Connected account does not belong to this book");
    }

    const conn: QboConnection = {
      realmId: account.realmId,
      accessToken: decryptToken(account.accessToken),
      refreshToken: decryptToken(account.refreshToken),
    };

    // Persist rotated tokens AND update the in-memory connection, so a refresh
    // mid-run rotates from the latest refresh token rather than the original
    const onRefresh = async (tokens: QboTokens): Promise<void> => {
      conn.accessToken = tokens.accessToken;
      conn.refreshToken = tokens.refreshToken;
      await dbPool
        .update(connectedAccountTable)
        .set({
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: encryptToken(tokens.refreshToken),
        })
        .where(eq(connectedAccountTable.id, connectedAccountId));
    };

    const [run] = await dbPool
      .select()
      .from(quickbooksReconciliationTable)
      .where(eq(quickbooksReconciliationTable.id, reconciliationId));

    if (!run) {
      throw new Error("QuickBooks reconciliation run not found");
    }

    await dbPool
      .update(quickbooksReconciliationTable)
      .set({ status: "running", updatedAt: new Date().toISOString() })
      .where(eq(quickbooksReconciliationTable.id, reconciliationId));

    const start = toIsoDate(run.periodStart);
    const end = toIsoDate(run.periodEnd);

    // QBO side: net each returned row as debit minus credit
    const qboReport = await queryTrialBalanceReport(conn, {
      start,
      end,
      onRefresh,
    });
    const qboRows = qboReport.map((row) => ({
      qboAccountId: row.qboAccountId,
      accountName: row.accountName,
      net: row.debit - row.credit,
    }));

    // MyFi side: net each account as debit minus credit, keyed by account id.
    // The per-account totals are raw SQL numeric strings, so parse with Number
    const myfi = await generateTrialBalance({
      bookId,
      startDate: start,
      endDate: end,
    });
    const myfiNetById = new Map<string, number>();
    const myfiNameById = new Map<string, string>();
    for (const acc of myfi.accounts) {
      myfiNetById.set(
        acc.accountId,
        Number(acc.debitTotal) - Number(acc.creditTotal),
      );
      myfiNameById.set(acc.accountId, acc.accountName);
    }

    const mapRows = await dbPool
      .select()
      .from(quickbooksAccountMapTable)
      .where(eq(quickbooksAccountMapTable.bookId, bookId));
    const qboToMyfi = new Map<string, string>(
      mapRows.map((row) => [row.qboAccountId, row.myfiAccountId]),
    );

    const lines: ReconLine[] = [];
    // MyFi accounts already paired with a QBO row, so the MyFi-only pass below
    // does not emit them a second time
    const coveredMyfi = new Set<string>();
    // Mapped QBO rows grouped by their resolved MyFi account, summing QBO nets.
    // Multiple QBO accounts may map to one MyFi account (the map is unique on
    // (bookId, qboAccountId) only, so consolidation is legitimate), and the
    // whole group nets against a single MyFi balance, so the MyFi side is
    // counted once rather than once per QBO row
    const mappedGroups = new Map<
      string,
      { qboNet: number; qboAccountIds: string[] }
    >();

    for (const row of qboRows) {
      const mappedMyfiId =
        row.qboAccountId !== null ? qboToMyfi.get(row.qboAccountId) : undefined;

      if (mappedMyfiId !== undefined && row.qboAccountId !== null) {
        const group = mappedGroups.get(mappedMyfiId) ?? {
          qboNet: 0,
          qboAccountIds: [],
        };
        group.qboNet += row.net;
        group.qboAccountIds.push(row.qboAccountId);
        mappedGroups.set(mappedMyfiId, group);
        continue;
      }

      // QBO-only: a null or unmapped QBO account has no MyFi counterpart
      lines.push({
        reconciliationId,
        bookId,
        myfiAccountId: null,
        qboAccountId: row.qboAccountId,
        accountName: row.accountName,
        qboBalance: money(row.net),
        myfiBalance: money(0),
        variance: money(row.net),
      });
    }

    // One line per mapped MyFi account: the summed QBO net against the MyFi net
    for (const [myfiAccountId, group] of mappedGroups) {
      const myfiNet = myfiNetById.get(myfiAccountId) ?? 0;
      const variance = group.qboNet - myfiNet;
      coveredMyfi.add(myfiAccountId);
      lines.push({
        reconciliationId,
        bookId,
        myfiAccountId,
        // A single QBO account keeps its id; a consolidated group is an
        // aggregate of several, so it carries no single qboAccountId
        qboAccountId:
          group.qboAccountIds.length === 1 ? group.qboAccountIds[0] : null,
        // Prefer the MyFi account name when known, else the first QBO name seen
        accountName:
          myfiNameById.get(myfiAccountId) ??
          qboRows.find((r) => r.qboAccountId === group.qboAccountIds[0])
            ?.accountName ??
          "",
        qboBalance: money(group.qboNet),
        myfiBalance: money(myfiNet),
        variance: money(variance),
      });
    }

    // MyFi-only: accounts with no QBO counterpart in this run
    for (const acc of myfi.accounts) {
      if (coveredMyfi.has(acc.accountId)) {
        continue;
      }
      const myfiNet = myfiNetById.get(acc.accountId) ?? 0;
      lines.push({
        reconciliationId,
        bookId,
        myfiAccountId: acc.accountId,
        qboAccountId: null,
        accountName: acc.accountName,
        qboBalance: money(0),
        myfiBalance: money(myfiNet),
        variance: money(0 - myfiNet),
      });
    }

    if (lines.length > 0) {
      await dbPool.insert(quickbooksReconciliationLineTable).values(lines);
    }

    // Aggregate over the parsed variances, not the formatted strings, so string
    // shape never introduces a false discrepancy
    let totalVariance = 0;
    let mismatchCount = 0;
    for (const line of lines) {
      const variance = Number(line.variance);
      totalVariance += Math.abs(variance);
      if (Math.abs(variance) > MISMATCH_TOLERANCE) {
        mismatchCount += 1;
      }
    }
    const totalVarianceStr = money(totalVariance);

    await dbPool
      .update(quickbooksReconciliationTable)
      .set({
        status: "complete",
        totalVariance: totalVarianceStr,
        mismatchCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quickbooksReconciliationTable.id, reconciliationId));

    return { totalVariance: totalVarianceStr, mismatchCount };
  } catch (error) {
    // Record only a generic message plus the error class, never a token,
    // secret, or raw QBO response body
    const name = error instanceof Error ? error.name : "Error";
    await dbPool
      .update(quickbooksReconciliationTable)
      .set({
        status: "failed",
        errorMessage: `QuickBooks reconciliation failed (${name})`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quickbooksReconciliationTable.id, reconciliationId));

    throw error;
  }
};
