interface AccountBalance {
  accountId: string;
  balance: string;
}

interface CloseLine {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

/**
 * Build the balanced year-end closing lines that zero every revenue and expense
 * account into retained earnings.
 *
 * Each account is closed in the direction that actually reverses its net
 * balance: a net credit is cleared with a debit and vice versa. The previous
 * code always debited revenue / credited expense by Math.abs(balance), which
 * diverged from the signed netIncome whenever an account carried a contra
 * balance (e.g. refunds exceeding sales), unbalancing the entry.
 *
 * @param params.revenueBalances - revenue account balances as credit - debit
 * @param params.expenseBalances - expense account balances as debit - credit
 * @param params.retainedEarningsId - equity account that absorbs net income
 * @returns the closing lines (memo-tagged) and the signed net income
 */
export const buildYearEndCloseLines = (params: {
  revenueBalances: AccountBalance[];
  expenseBalances: AccountBalance[];
  retainedEarningsId: string;
}): { lines: CloseLine[]; netIncome: number } => {
  const lines: CloseLine[] = [];

  let totalRevenue = 0;
  for (const rev of params.revenueBalances) {
    const bal = Number(rev.balance);
    totalRevenue += bal;
    if (Math.abs(bal) < 0.005) continue;
    lines.push({
      accountId: rev.accountId,
      debit: bal > 0 ? bal.toFixed(4) : "0.0000",
      credit: bal < 0 ? Math.abs(bal).toFixed(4) : "0.0000",
      memo: "Close revenue to retained earnings",
    });
  }

  let totalExpenses = 0;
  for (const exp of params.expenseBalances) {
    const bal = Number(exp.balance);
    totalExpenses += bal;
    if (Math.abs(bal) < 0.005) continue;
    lines.push({
      accountId: exp.accountId,
      debit: bal < 0 ? Math.abs(bal).toFixed(4) : "0.0000",
      credit: bal > 0 ? bal.toFixed(4) : "0.0000",
      memo: "Close expense to retained earnings",
    });
  }

  const netIncome = Math.round((totalRevenue - totalExpenses) * 10000) / 10000;

  if (Math.abs(netIncome) >= 0.005) {
    lines.push({
      accountId: params.retainedEarningsId,
      debit: netIncome < 0 ? Math.abs(netIncome).toFixed(4) : "0.0000",
      credit: netIncome > 0 ? netIncome.toFixed(4) : "0.0000",
      memo:
        netIncome > 0
          ? "Net income to retained earnings"
          : "Net loss to retained earnings",
    });
  }

  return { lines, netIncome };
};
