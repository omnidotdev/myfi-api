interface DebtOpeningLine {
  accountId: string;
  debit: string;
  credit: string;
}

/**
 * Build the two balanced journal lines that record an opening debt balance:
 * credit the liability (the debt increases) and debit the offsetting equity
 * account (net worth decreases by what is owed). Amounts are written as
 * numeric(19,4) strings, matching the journal_line columns.
 *
 * Returns null when there is no positive amount to record, so the caller can
 * create the liability account without an opening entry
 * @param params.liabilityAccountId - The debt's liability account
 * @param params.offsetAccountId - The equity account the balance offsets against
 * @param params.amount - Amount owed (must be > 0 to produce lines)
 */
export const buildDebtOpeningLines = (params: {
  liabilityAccountId: string;
  offsetAccountId: string;
  amount: number;
}): DebtOpeningLine[] | null => {
  const { liabilityAccountId, offsetAccountId, amount } = params;
  if (!(amount > 0)) return null;
  const value = amount.toFixed(4);
  return [
    { accountId: liabilityAccountId, debit: "0.0000", credit: value },
    { accountId: offsetAccountId, debit: value, credit: "0.0000" },
  ];
};
