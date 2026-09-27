interface DebtPaymentLine {
  accountId: string;
  debit: string;
  credit: string;
}

/**
 * Build the two balanced journal lines that record a payment against a debt:
 * debit the liability (what you owe goes down) and credit the funding account
 * (cash leaving an asset account, or an equity account when the payment source
 * is not tracked). Amounts are numeric(19,4) strings.
 *
 * Returns null when there is no positive amount to record
 * @param params.liabilityAccountId - The debt's liability account
 * @param params.creditAccountId - Where the payment comes from (asset) or the
 *   equity account when the source is not specified
 * @param params.amount - Payment amount (must be > 0)
 */
export const buildDebtPaymentLines = (params: {
  liabilityAccountId: string;
  creditAccountId: string;
  amount: number;
}): DebtPaymentLine[] | null => {
  const { liabilityAccountId, creditAccountId, amount } = params;
  if (!(amount > 0)) return null;
  const value = amount.toFixed(4);
  return [
    { accountId: liabilityAccountId, debit: value, credit: "0.0000" },
    { accountId: creditAccountId, debit: "0.0000", credit: value },
  ];
};
