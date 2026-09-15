// Money is handled as integer ten-thousandths to match the numeric(19,4) ledger
// columns and the .toFixed(4) writes, so totals and the balance check are exact
// (no binary-float drift). This mirrors importOpeningBalances
export const MONEY_SCALE = 10000;

/** Round a decimal amount to integer ten-thousandths */
export const toUnits = (amount: number): number =>
  Math.round(amount * MONEY_SCALE);

/** Convert integer ten-thousandths back to a decimal amount */
const fromUnits = (units: number): number => units / MONEY_SCALE;

/** Extended amount for a line: quantity times unit price, at 4-decimal scale */
export const computeLineAmount = (
  quantity: number,
  unitPrice: number,
): number => fromUnits(Math.round(quantity * unitPrice * MONEY_SCALE));

/** Tax for a line: amount times rate (rate as a fraction, e.g. 0.0825) */
export const computeLineTax = (amount: number, rate: number): number =>
  fromUnits(Math.round(amount * rate * MONEY_SCALE));

/** A priced invoice line, ready for totaling and posting */
export interface PricedLine {
  /** Pre-tax extended amount (quantity times unit price) */
  amount: number;
  /** Tax charged on this line (0 when untaxed) */
  taxAmount: number;
  /** Income account the line's revenue credits */
  incomeAccountId: string;
  /** Liability account the line's tax credits, required when taxAmount is non-zero */
  taxPayableAccountId?: string | null;
}

interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** Sum priced lines into subtotal, tax, and total (exact in ten-thousandths) */
export const computeInvoiceTotals = (lines: PricedLine[]): InvoiceTotals => {
  let subtotalUnits = 0;
  let taxUnits = 0;
  for (const line of lines) {
    subtotalUnits += toUnits(line.amount);
    taxUnits += toUnits(line.taxAmount);
  }
  return {
    subtotal: fromUnits(subtotalUnits),
    taxAmount: fromUnits(taxUnits),
    total: fromUnits(subtotalUnits + taxUnits),
  };
};

/** A single ledger posting (a debit or a credit against one account) */
interface Posting {
  accountId: string;
  debit: number;
  credit: number;
}

/**
 * Build the balanced double-entry postings for an invoice: debit Accounts
 * Receivable for the full total, credit each income account for its line
 * revenue, and credit each tax jurisdiction's payable account for its tax.
 * Credits are consolidated per account so an invoice with several lines on one
 * income account produces a single credit line. Throws if the result does not
 * balance, which is the invariant every ledger write must hold
 */
export const buildInvoicePostings = (opts: {
  arAccountId: string;
  lines: PricedLine[];
}): Posting[] => {
  const { arAccountId, lines } = opts;
  if (lines.length === 0) {
    throw new Error("Invoice has no lines to post");
  }

  const creditUnits = new Map<string, number>();
  const addCredit = (accountId: string, units: number) => {
    creditUnits.set(accountId, (creditUnits.get(accountId) ?? 0) + units);
  };

  let debitUnits = 0;
  for (const line of lines) {
    const amount = toUnits(line.amount);
    addCredit(line.incomeAccountId, amount);
    debitUnits += amount;

    const tax = toUnits(line.taxAmount);
    if (tax !== 0) {
      if (!line.taxPayableAccountId) {
        throw new Error("A taxed line has no tax payable account");
      }
      addCredit(line.taxPayableAccountId, tax);
      debitUnits += tax;
    }
  }

  const postings: Posting[] = [
    { accountId: arAccountId, debit: fromUnits(debitUnits), credit: 0 },
  ];
  let totalCredit = 0;
  for (const [accountId, units] of creditUnits) {
    postings.push({ accountId, debit: 0, credit: fromUnits(units) });
    totalCredit += units;
  }

  if (debitUnits !== totalCredit) {
    throw new Error("Invoice postings do not balance");
  }

  return postings;
};
