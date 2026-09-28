interface PayoffLine {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Build the balanced journal lines for paying off a loan:
 * - debit the liability for the remaining balance,
 * - if the payoff exceeds the balance, debit the extra as interest,
 * - if the payoff is LESS than the balance (a settlement / forgiveness), credit
 *   the forgiven difference to an equity account (a gain), which requires an
 *   equity account,
 * - credit the payment account for the cash paid.
 *
 * Returns null when a settlement is attempted with no equity account to book the
 * forgiveness against (the entry could not balance otherwise)
 */
export const buildLoanPayoffLines = (params: {
  liabilityAccountId: string;
  interestAccountId: string;
  paymentAccountId: string;
  equityAccountId: string | null;
  currentBalance: number;
  payoffAmount: number;
}): PayoffLine[] | null => {
  const balance = round4(params.currentBalance);
  const payoff = round4(params.payoffAmount);

  const lines: PayoffLine[] = [
    {
      accountId: params.liabilityAccountId,
      debit: balance.toFixed(4),
      credit: "0.0000",
      memo: "Payoff principal",
    },
  ];

  const diff = round4(payoff - balance);

  if (diff > 0) {
    // Paid more than owed: the extra is interest
    lines.push({
      accountId: params.interestAccountId,
      debit: diff.toFixed(4),
      credit: "0.0000",
      memo: "Payoff interest",
    });
  } else if (diff < 0) {
    // Settled for less than owed: the forgiven amount is a gain (to equity)
    if (!params.equityAccountId) return null;
    lines.push({
      accountId: params.equityAccountId,
      debit: "0.0000",
      credit: (-diff).toFixed(4),
      memo: "Debt forgiveness",
    });
  }

  lines.push({
    accountId: params.paymentAccountId,
    debit: "0.0000",
    credit: payoff.toFixed(4),
    memo: "Payoff payment",
  });

  return lines;
};
