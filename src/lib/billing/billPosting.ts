import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

/** A priced bill line, ready for posting (mirror of the invoice PricedLine) */
export interface PricedBillLine {
  /** Pre-tax extended amount (quantity times unit price) */
  amount: number;
  /** Tax charged on this line (0 when untaxed) */
  taxAmount: number;
  /** Expense (or asset) account the line's cost debits */
  expenseAccountId: string;
  /**
   * Retained for parity with the invoice line shape, but NOT posted: under US
   * sales-tax treatment, tax a business pays a vendor is part of the cost of
   * the purchase, not a recoverable input-tax credit, so it is folded into the
   * expense debit rather than debited to a tax-payable liability
   */
  taxPayableAccountId?: string | null;
}

/** A single ledger posting (a debit or a credit against one account) */
interface Posting {
  accountId: string;
  debit: number;
  credit: number;
}

/**
 * Build the balanced double-entry postings for a vendor bill: credit Accounts
 * Payable for the full total (cost plus any sales tax paid), and debit each
 * expense account for its line cost including that tax. Under US treatment the
 * sales tax a business pays a vendor is part of the purchase cost, not a
 * recoverable input-tax credit, so it is never debited to the sales-tax-payable
 * liability (which tracks only tax the business collects and must remit).
 * Debits are consolidated per account. Throws if the result does not balance
 */
export const buildBillPostings = (opts: {
  apAccountId: string;
  lines: PricedBillLine[];
}): Posting[] => {
  const { apAccountId, lines } = opts;
  if (lines.length === 0) {
    throw new Error("Bill has no lines to post");
  }

  const debitUnits = new Map<string, number>();
  const addDebit = (accountId: string, units: number) => {
    debitUnits.set(accountId, (debitUnits.get(accountId) ?? 0) + units);
  };

  let creditUnits = 0;
  for (const line of lines) {
    // Cost plus sales tax paid both debit the expense/asset account (US
    // treatment); AP is credited for the full cash-outflow total
    const amount = toUnits(line.amount) + toUnits(line.taxAmount);
    addDebit(line.expenseAccountId, amount);
    creditUnits += amount;
  }

  const postings: Posting[] = [];
  let totalDebit = 0;
  for (const [accountId, units] of debitUnits) {
    postings.push({ accountId, debit: fromUnits(units), credit: 0 });
    totalDebit += units;
  }
  postings.push({
    accountId: apAccountId,
    debit: 0,
    credit: fromUnits(creditUnits),
  });

  if (totalDebit !== creditUnits) {
    throw new Error("Bill postings do not balance");
  }

  return postings;
};
