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
  // Integer ten-thousandths so the emitted lines and the retained-earnings line
  // balance exactly. Only an exactly-zero balance is skipped; an earlier 0.005
  // threshold dropped sub-cent lines while still counting them toward net
  // income, leaving the retained-earnings line with nothing to offset it
  const SCALE = 10000;
  const toUnits = (raw: string) =>
    Math.round((Number.parseFloat(raw) || 0) * SCALE);
  const fromUnits = (units: number) => (units / SCALE).toFixed(4);

  const lines: CloseLine[] = [];
  let debitUnits = 0;
  let creditUnits = 0;

  for (const rev of params.revenueBalances) {
    // Revenue balance is credit - debit; clear a net credit with a debit
    const units = toUnits(rev.balance);
    if (units === 0) continue;
    lines.push({
      accountId: rev.accountId,
      debit: units > 0 ? fromUnits(units) : "0.0000",
      credit: units < 0 ? fromUnits(-units) : "0.0000",
      memo: "Close revenue to retained earnings",
    });
    if (units > 0) debitUnits += units;
    else creditUnits += -units;
  }

  for (const exp of params.expenseBalances) {
    // Expense balance is debit - credit; clear a net debit with a credit
    const units = toUnits(exp.balance);
    if (units === 0) continue;
    lines.push({
      accountId: exp.accountId,
      debit: units < 0 ? fromUnits(-units) : "0.0000",
      credit: units > 0 ? fromUnits(units) : "0.0000",
      memo: "Close expense to retained earnings",
    });
    if (units > 0) creditUnits += units;
    else debitUnits += -units;
  }

  // Retained earnings absorbs the exact residual between the emitted debits and
  // credits (a net credit is net income, a net debit is a net loss)
  const residualUnits = debitUnits - creditUnits;
  if (residualUnits !== 0) {
    lines.push({
      accountId: params.retainedEarningsId,
      debit: residualUnits < 0 ? fromUnits(-residualUnits) : "0.0000",
      credit: residualUnits > 0 ? fromUnits(residualUnits) : "0.0000",
      memo:
        residualUnits > 0
          ? "Net income to retained earnings"
          : "Net loss to retained earnings",
    });
  }

  return { lines, netIncome: residualUnits / SCALE };
};
