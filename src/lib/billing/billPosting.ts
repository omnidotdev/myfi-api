import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

/** A priced bill line, ready for posting (mirror of the invoice PricedLine) */
export interface PricedBillLine {
  /** Pre-tax extended amount (quantity times unit price) */
  amount: number;
  /** Tax charged on this line (0 when untaxed) */
  taxAmount: number;
  /** Expense (or asset) account the line's cost debits */
  expenseAccountId: string;
  /** Liability account the line's tax debits (input tax), required when taxAmount is non-zero */
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
 * Payable for the full total, debit each expense account for its line cost, and
 * debit each tax jurisdiction's payable account for the input tax. The exact
 * mirror of buildInvoicePostings. Debits are consolidated per account. Throws if
 * the result does not balance
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
    const amount = toUnits(line.amount);
    addDebit(line.expenseAccountId, amount);
    creditUnits += amount;

    const tax = toUnits(line.taxAmount);
    if (tax !== 0) {
      if (!line.taxPayableAccountId) {
        throw new Error("A taxed line has no tax payable account");
      }
      addDebit(line.taxPayableAccountId, tax);
      creditUnits += tax;
    }
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
