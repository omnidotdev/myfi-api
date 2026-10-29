import { and, asc, eq, inArray, ne } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  billTable,
  bookTable,
  invoiceTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { resolveFxAccount } from "lib/accounting/fxAccount";
import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

const REVALUATION_SOURCE = "fx_revaluation";
const REVALUATION_REVERSAL_SOURCE = "fx_revaluation_reversal";

interface RevalueResult {
  /** Adjusting entry at asOfDate, or null when nothing needed revaluing */
  adjustmentEntryId: string | null;
  /** Reversing entry on the next period, or null */
  reversalEntryId: string | null;
  /** Net unrealized gain (positive) or loss (negative) in home currency */
  netGainLoss: number;
}

/** The day after a YYYY-MM-DD date, as YYYY-MM-DD */
const nextDay = (date: string): string => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Period-end unrealized foreign-exchange revaluation (QuickBooks' "Home
 * Currency Adjustment"). Open foreign-currency receivables and payables were
 * booked at their transaction rates; at period end their home-currency value
 * has drifted. This revalues the still-open balances to the supplied current
 * rates and posts the unrealized gain/loss, then posts a reversing entry on the
 * next day. The reversal is essential: it keeps the adjustment on the period-end
 * balance sheet only, so it never double-counts the realized gain/loss booked
 * at settlement (which uses each document's original rate).
 *
 * @param rates - current home-per-foreign rate keyed by currency code; a
 *   currency with no rate supplied is skipped
 */
export const revalueForeignBalances = async (params: {
  bookId: string;
  asOfDate: string;
  rates: Record<string, number>;
  /** Defaults to the day after asOfDate */
  reverseDate?: string | null;
}): Promise<RevalueResult> => {
  const { bookId, asOfDate, rates } = params;
  const reverseDate = params.reverseDate ?? nextDay(asOfDate);

  const [book] = await dbPool
    .select({ currency: bookTable.currency })
    .from(bookTable)
    .where(eq(bookTable.id, bookId));
  if (!book) {
    throw new Error("Book not found");
  }
  const home = book.currency;

  // Home-currency delta = outstanding (foreign) x (current rate - booked rate),
  // summed across all still-open foreign documents
  const deltaUnits = (
    rows: { total: string; amountPaid: string; currency: string; rate: string }[],
  ): number => {
    let units = 0;
    for (const row of rows) {
      const current = rates[row.currency];
      if (current === undefined) continue;
      const outstanding =
        (Number.parseFloat(row.total) || 0) -
        (Number.parseFloat(row.amountPaid) || 0);
      if (outstanding <= 0) continue;
      units += toUnits(outstanding * (current - (Number.parseFloat(row.rate) || 1)));
    }
    return units;
  };

  const invoices = await dbPool
    .select({
      total: invoiceTable.total,
      amountPaid: invoiceTable.amountPaid,
      currency: invoiceTable.currency,
      rate: invoiceTable.exchangeRate,
    })
    .from(invoiceTable)
    .where(
      and(
        eq(invoiceTable.bookId, bookId),
        inArray(invoiceTable.status, ["open", "partial"]),
        ne(invoiceTable.currency, home),
      ),
    );
  const bills = await dbPool
    .select({
      total: billTable.total,
      amountPaid: billTable.amountPaid,
      currency: billTable.currency,
      rate: billTable.exchangeRate,
    })
    .from(billTable)
    .where(
      and(
        eq(billTable.bookId, bookId),
        inArray(billTable.status, ["open", "partial"]),
        ne(billTable.currency, home),
      ),
    );

  const arDeltaUnits = deltaUnits(invoices);
  const apDeltaUnits = deltaUnits(bills);

  if (arDeltaUnits === 0 && apDeltaUnits === 0) {
    return { adjustmentEntryId: null, reversalEntryId: null, netGainLoss: 0 };
  }

  const resolveBalanceAccount = async (
    subType: "accounts_receivable" | "accounts_payable",
  ): Promise<string | null> => {
    const [acct] = await dbPool
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.bookId, bookId),
          eq(accountTable.subType, subType),
          eq(accountTable.isActive, true),
        ),
      )
      .orderBy(asc(accountTable.createdAt))
      .limit(1);
    return acct?.id ?? null;
  };

  const arAccountId =
    arDeltaUnits !== 0 ? await resolveBalanceAccount("accounts_receivable") : null;
  const apAccountId =
    apDeltaUnits !== 0 ? await resolveBalanceAccount("accounts_payable") : null;
  if (arDeltaUnits !== 0 && !arAccountId) {
    throw new Error("No active Accounts Receivable account exists for this book");
  }
  if (apDeltaUnits !== 0 && !apAccountId) {
    throw new Error("No active Accounts Payable account exists for this book");
  }

  // A rising AR (asset) is an unrealized gain; a rising AP (liability) is an
  // unrealized loss. The FX line nets the two so the entry balances
  const fxNetUnits = arDeltaUnits - apDeltaUnits;

  const line = (accountId: string, units: number) => ({
    accountId,
    debit: units > 0 ? fromUnits(units).toFixed(4) : "0.0000",
    credit: units < 0 ? fromUnits(-units).toFixed(4) : "0.0000",
  });

  return dbPool.transaction(async (tx) => {
    const fxAccountId = await resolveFxAccount(tx, bookId);

    const buildLines = (sign: 1 | -1) => {
      const parts: { accountId: string; debit: string; credit: string }[] = [];
      if (arAccountId && arDeltaUnits !== 0) {
        parts.push(line(arAccountId, sign * arDeltaUnits));
      }
      if (apAccountId && apDeltaUnits !== 0) {
        // AP is a liability: a positive delta is a credit (debit of -delta)
        parts.push(line(apAccountId, sign * -apDeltaUnits));
      }
      // FX takes the balancing side: a net gain credits it, a net loss debits it
      parts.push(line(fxAccountId, sign * -fxNetUnits));
      return parts;
    };

    const writeEntry = async (
      date: string,
      source: string,
      memo: string,
      sign: 1 | -1,
    ): Promise<string> => {
      const [entry] = await tx
        .insert(journalEntryTable)
        .values({
          bookId,
          date,
          memo,
          source,
          isReviewed: true,
        } satisfies InferInsertModel<typeof journalEntryTable>)
        .returning();
      if (!entry) {
        throw new Error("Failed to write the revaluation entry");
      }
      for (const part of buildLines(sign)) {
        await tx.insert(journalLineTable).values({
          journalEntryId: entry.id,
          ...part,
        } satisfies InferInsertModel<typeof journalLineTable>);
      }
      return entry.id;
    };

    const adjustmentEntryId = await writeEntry(
      asOfDate,
      REVALUATION_SOURCE,
      `Unrealized FX revaluation ${asOfDate}`,
      1,
    );
    const reversalEntryId = await writeEntry(
      reverseDate,
      REVALUATION_REVERSAL_SOURCE,
      `Reverse unrealized FX revaluation ${asOfDate}`,
      -1,
    );

    return {
      adjustmentEntryId,
      reversalEntryId,
      netGainLoss: fromUnits(fxNetUnits),
    };
  });
};
