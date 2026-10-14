// Money is handled as integer ten-thousandths to match the numeric(19,4)
// ledger columns, so the disposal entry balances exactly with no float drift
const MONEY_SCALE = 10000;

const toUnits = (raw: string | number): number =>
  Math.round((Number(raw) || 0) * MONEY_SCALE);

const unitsToString = (units: number): string =>
  (units / MONEY_SCALE).toFixed(4);

interface DisposalLine {
  accountId: string;
  debit: string;
  credit: string;
}

/**
 * Build the balanced journal lines that retire a fixed asset on disposal:
 * remove the asset at cost (credit), clear its accumulated depreciation
 * (debit), record the sale proceeds (debit), and book the gain or loss.
 *
 * The gain/loss line absorbs the EXACT residual between proceeds + accumulated
 * depreciation and cost, computed in integer units, so the entry always
 * balances - including a sub-cent residual that an earlier materiality
 * threshold would have dropped, leaving the entry unbalanced. Zero-amount
 * lines (e.g. a disposal for no proceeds) are omitted because the journal
 * validator rejects a line with neither a debit nor a credit.
 */
export const buildDisposalLines = (params: {
  acquisitionCost: string | number;
  totalDepreciated: string | number;
  proceeds: string | number;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  proceedsAccountId: string;
  gainLossAccountId: string;
}): DisposalLine[] => {
  const costUnits = toUnits(params.acquisitionCost);
  const depUnits = toUnits(params.totalDepreciated);
  const proceedsUnits = toUnits(params.proceeds);

  const lines: DisposalLine[] = [];

  if (proceedsUnits > 0) {
    lines.push({
      accountId: params.proceedsAccountId,
      debit: unitsToString(proceedsUnits),
      credit: "0",
    });
  }
  if (depUnits > 0) {
    lines.push({
      accountId: params.accumulatedDepreciationAccountId,
      debit: unitsToString(depUnits),
      credit: "0",
    });
  }
  lines.push({
    accountId: params.assetAccountId,
    debit: "0",
    credit: unitsToString(costUnits),
  });

  // Residual between debits (proceeds + accumulated depreciation) and credits
  // (cost) so far; a positive residual is a gain (credit), negative is a loss
  // (debit). Posted exactly, with no materiality threshold
  const residualUnits = proceedsUnits + depUnits - costUnits;
  if (residualUnits > 0) {
    lines.push({
      accountId: params.gainLossAccountId,
      debit: "0",
      credit: unitsToString(residualUnits),
    });
  } else if (residualUnits < 0) {
    lines.push({
      accountId: params.gainLossAccountId,
      debit: unitsToString(-residualUnits),
      credit: "0",
    });
  }

  return lines;
};
