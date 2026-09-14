import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

import type { OpeningBalanceLine } from "./importOpeningBalances";
import type {
  ParsedTrialBalance,
  ParsedTrialBalanceAccount,
} from "./parseTrialBalanceCsv";

interface BookAccountRow {
  id: string;
  code: string | null;
  name: string;
}

interface ResolveResult {
  /** Trial-balance accounts matched to a MyFi account, ready to import */
  mapped: OpeningBalanceLine[];
  /** Trial-balance accounts with no confident MyFi match, for the user to resolve */
  unmatched: ParsedTrialBalanceAccount[];
}

const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * Match a trial-balance account to a MyFi account. Conservative, mirroring the
 * QuickBooks account auto-map: a UNIQUE account-number/code match wins, else a
 * UNIQUE case-insensitive name match. Zero or ambiguous matches are left
 * unmatched (never guessed), so the user resolves them explicitly. Account type
 * is never used to match
 */
const matchAccount = (
  account: ParsedTrialBalanceAccount,
  chart: readonly BookAccountRow[],
): string | null => {
  const acctNum = account.accountNum?.trim();
  if (acctNum) {
    const byCode = chart.filter((a) => a.code?.trim() === acctNum);
    if (byCode.length === 1 && byCode[0]) return byCode[0].id;
  }

  const name = normalizeName(account.name);
  const byName = chart.filter((a) => normalizeName(a.name) === name);
  if (byName.length === 1 && byName[0]) return byName[0].id;

  return null;
};

/**
 * Resolve every parsed trial-balance account against a book's chart of accounts,
 * partitioning into confidently-mapped lines (ready for the opening-balance
 * import) and unmatched accounts (surfaced for the user to map or create).
 */
const resolveTrialBalanceAccounts = async (opts: {
  bookId: string;
  parsed: ParsedTrialBalance;
}): Promise<ResolveResult> => {
  const { bookId, parsed } = opts;

  const chart: BookAccountRow[] = await dbPool
    .select({
      id: accountTable.id,
      code: accountTable.code,
      name: accountTable.name,
    })
    .from(accountTable)
    .where(eq(accountTable.bookId, bookId));

  const mapped: OpeningBalanceLine[] = [];
  const unmatched: ParsedTrialBalanceAccount[] = [];

  for (const account of parsed.accounts) {
    const accountId = matchAccount(account, chart);
    if (accountId) {
      mapped.push({
        accountId,
        debit: account.debit,
        credit: account.credit,
        name: account.name,
      });
    } else {
      unmatched.push(account);
    }
  }

  return { mapped, unmatched };
};

export { resolveTrialBalanceAccounts, matchAccount };
