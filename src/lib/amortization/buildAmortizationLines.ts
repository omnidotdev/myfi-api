interface AmortizationLine {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

/**
 * Build the three balanced journal lines for one amortization payment: debit
 * interest, debit the liability for principal + any extra principal, and credit
 * the payment account for the sum of those debits.
 *
 * The stored `paymentAmount` already includes the extra principal, so crediting
 * `paymentAmount + extraPrincipal` double-counted the extra and left the entry
 * unbalanced. Crediting the exact sum of the debit components guarantees
 * balance regardless of rounding
 */
export const buildAmortizationLines = (params: {
  interestAccountId: string;
  liabilityAccountId: string;
  paymentAccountId: string;
  interestAmount: string;
  principalAmount: string;
  extraPrincipal: string;
}): AmortizationLine[] => {
  const interest = Number(params.interestAmount);
  const principalTotal =
    Number(params.principalAmount) + Number(params.extraPrincipal);
  const payment = interest + principalTotal;

  return [
    {
      accountId: params.interestAccountId,
      debit: interest.toFixed(4),
      credit: "0.0000",
      memo: "Interest",
    },
    {
      accountId: params.liabilityAccountId,
      debit: principalTotal.toFixed(4),
      credit: "0.0000",
      memo: "Principal",
    },
    {
      accountId: params.paymentAccountId,
      debit: "0.0000",
      credit: payment.toFixed(4),
      memo: "Payment",
    },
  ];
};
