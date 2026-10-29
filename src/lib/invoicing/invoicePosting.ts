// Money is handled as integer ten-thousandths to match the numeric(19,4) ledger
// columns and the .toFixed(4) writes, so totals and the balance check are exact
// (no binary-float drift). This mirrors importOpeningBalances
export const MONEY_SCALE = 10000;

/** Round a decimal amount to integer ten-thousandths */
export const toUnits = (amount: number): number =>
  Math.round(amount * MONEY_SCALE);

/** Convert integer ten-thousandths back to a decimal amount */
export const fromUnits = (units: number): number => units / MONEY_SCALE;

/** Extended amount for a line: quantity times unit price, at 4-decimal scale */
export const computeLineAmount = (
  quantity: number,
  unitPrice: number,
): number => fromUnits(Math.round(quantity * unitPrice * MONEY_SCALE));

/** Tax for a line: amount times rate (rate as a fraction, e.g. 0.0825) */
export const computeLineTax = (amount: number, rate: number): number =>
  fromUnits(Math.round(amount * rate * MONEY_SCALE));

/**
 * Apply a line discount to an extended amount, returning the net at 4-decimal
 * scale. The discount is a fraction (e.g. 0.1 for 10% off); null or zero leaves
 * the amount unchanged. Out-of-range fractions are clamped to [0, 1] so a bad
 * input can never inflate the amount or drive it negative
 */
export const applyLineDiscount = (
  amount: number,
  discountPercent?: number | null,
): number => {
  if (!discountPercent) return amount;
  const fraction = Math.min(Math.max(discountPercent, 0), 1);
  return fromUnits(Math.round(toUnits(amount) * (1 - fraction)));
};

/** One tax charged on a line, attributed to a jurisdiction's payable account */
export interface LineTax {
  amount: number;
  taxPayableAccountId: string;
  taxJurisdictionId?: string | null;
}

/** A priced invoice line, ready for totaling and posting */
export interface PricedLine {
  /** Pre-tax extended amount (quantity times unit price) */
  amount: number;
  /** Total tax charged on this line (0 when untaxed) */
  taxAmount: number;
  /** Income account the line's revenue credits */
  incomeAccountId: string;
  /** Liability account the line's tax credits, required when taxAmount is non-zero */
  taxPayableAccountId?: string | null;
  /** Jurisdiction the line's tax belongs to, tagged onto the tax posting */
  taxJurisdictionId?: string | null;
  /**
   * Per-tax breakdown when a line carries more than one tax (e.g. a compound
   * tax stacking on a base tax). When present it is authoritative for posting
   * and totals; when absent the single taxAmount/taxPayableAccountId is used
   */
  taxes?: LineTax[];
}

/** The line's taxes, from the explicit breakdown or the legacy single tax */
const normalizeLineTaxes = (line: PricedLine): LineTax[] => {
  if (line.taxes && line.taxes.length > 0) return line.taxes;
  if (toUnits(line.taxAmount) !== 0) {
    if (!line.taxPayableAccountId) {
      throw new Error("A taxed line has no tax payable account");
    }
    return [
      {
        amount: line.taxAmount,
        taxPayableAccountId: line.taxPayableAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
      },
    ];
  }
  return [];
};

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
    // Totals only need amounts, not payable accounts: sum the breakdown when
    // present, otherwise the single taxAmount
    if (line.taxes && line.taxes.length > 0) {
      for (const tax of line.taxes) taxUnits += toUnits(tax.amount);
    } else {
      taxUnits += toUnits(line.taxAmount);
    }
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
  /** Set on tax-payable credits so collected tax is attributable per jurisdiction */
  taxJurisdictionId?: string | null;
}

/**
 * Build the balanced double-entry postings for an invoice: debit Accounts
 * Receivable for the full total, credit each income account for its line
 * revenue, and credit each tax jurisdiction's payable account for its tax.
 * Income credits are consolidated per account, and tax credits per account AND
 * jurisdiction, so two jurisdictions sharing one payable account still post
 * separate, attributable tax credits. Throws if the result does not balance,
 * which is the invariant every ledger write must hold
 */
export const buildInvoicePostings = (opts: {
  arAccountId: string;
  lines: PricedLine[];
}): Posting[] => {
  const { arAccountId, lines } = opts;
  if (lines.length === 0) {
    throw new Error("Invoice has no lines to post");
  }

  const incomeUnits = new Map<string, number>();
  // Tax credits keyed by account + jurisdiction so a shared payable account does
  // not merge two jurisdictions' tax into one untraceable credit
  const taxUnits = new Map<
    string,
    { accountId: string; taxJurisdictionId: string | null; units: number }
  >();

  let debitUnits = 0;
  for (const line of lines) {
    const amount = toUnits(line.amount);
    incomeUnits.set(
      line.incomeAccountId,
      (incomeUnits.get(line.incomeAccountId) ?? 0) + amount,
    );
    debitUnits += amount;

    for (const lineTax of normalizeLineTaxes(line)) {
      const tax = toUnits(lineTax.amount);
      if (tax === 0) continue;
      const jurisdictionId = lineTax.taxJurisdictionId ?? null;
      const key = `${lineTax.taxPayableAccountId}\u0000${jurisdictionId ?? ""}`;
      const existing = taxUnits.get(key);
      if (existing) {
        existing.units += tax;
      } else {
        taxUnits.set(key, {
          accountId: lineTax.taxPayableAccountId,
          taxJurisdictionId: jurisdictionId,
          units: tax,
        });
      }
      debitUnits += tax;
    }
  }

  const postings: Posting[] = [
    { accountId: arAccountId, debit: fromUnits(debitUnits), credit: 0 },
  ];
  let totalCredit = 0;
  for (const [accountId, units] of incomeUnits) {
    postings.push({ accountId, debit: 0, credit: fromUnits(units) });
    totalCredit += units;
  }
  for (const { accountId, taxJurisdictionId, units } of taxUnits.values()) {
    postings.push({
      accountId,
      debit: 0,
      credit: fromUnits(units),
      taxJurisdictionId,
    });
    totalCredit += units;
  }

  if (debitUnits !== totalCredit) {
    throw new Error("Invoice postings do not balance");
  }

  return postings;
};
