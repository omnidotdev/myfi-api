import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

import type { OpeningBalanceLine } from "./importOpeningBalances";
import type { ParsedTrialBalanceAccount } from "./parseTrialBalanceCsv";

type AccountType = (typeof accountTable.type.enumValues)[number];

/**
 * Infer a MyFi account type for an account being created from a QuickBooks trial
 * balance. Standard chart-of-accounts numbering is the strongest signal
 * (1xxx=asset, 2xxx=liability, 3xxx=equity, 4xxx=revenue, 5xxx+=expense). For a
 * numberless account, fall back to equity-name keywords, then to the normal
 * balance side. The type is a best guess the user can change afterward
 */
const inferAccountType = (
  accountNum: string | undefined,
  name: string,
  debit: number,
  credit: number,
): AccountType => {
  const lead = accountNum?.[0];
  if (lead === "1") return "asset";
  if (lead === "2") return "liability";
  if (lead === "3") return "equity";
  if (lead === "4") return "revenue";
  if (lead && "56789".includes(lead)) return "expense";

  // Numberless account: match well-known names, then fall back to the normal
  // balance side
  const lower = name.toLowerCase();
  if (
    /retained earnings|owner|equity|capital|distribution|draw|investment|opening balance/.test(
      lower,
    )
  ) {
    return "equity";
  }
  if (
    /payable|credit card|loan|note|accrued|unearned|deferred|liabilit/.test(
      lower,
    )
  ) {
    return "liability";
  }
  if (
    /receivable|checking|savings|\bcash\b|\bbank\b|inventory|prepaid|undeposited|asset/.test(
      lower,
    )
  ) {
    return "asset";
  }

  return credit > debit ? "revenue" : "expense";
};

/**
 * Create MyFi accounts mirroring the given (unmatched) QuickBooks trial-balance
 * accounts, so a migration reproduces the QuickBooks chart instead of forcing
 * the user to hand-map every account onto a generic template. The QuickBooks
 * account number becomes the MyFi `code`, so a re-import auto-matches these
 * (never creating duplicates). Returns opening-balance lines for the new
 * accounts.
 */
const createAccountsForUnmatched = async (opts: {
  bookId: string;
  accounts: ParsedTrialBalanceAccount[];
}): Promise<OpeningBalanceLine[]> => {
  const { bookId, accounts } = opts;
  const lines: OpeningBalanceLine[] = [];

  for (const account of accounts) {
    const [row] = await dbPool
      .insert(accountTable)
      .values({
        bookId,
        name: account.name,
        code: account.accountNum ?? null,
        type: inferAccountType(
          account.accountNum,
          account.name,
          account.debit,
          account.credit,
        ),
        isActive: true,
      })
      .returning({ id: accountTable.id });

    if (!row) throw new Error(`Failed to create account "${account.name}"`);

    lines.push({
      accountId: row.id,
      debit: account.debit,
      credit: account.credit,
      name: account.name,
    });
  }

  return lines;
};

export { inferAccountType, createAccountsForUnmatched };
