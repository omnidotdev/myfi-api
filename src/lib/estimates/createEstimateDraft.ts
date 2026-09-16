import { dbPool } from "lib/db/db";
import { estimateLineTable, estimateTable } from "lib/db/schema";
import {
  computeLineAmount,
  fromUnits,
  toUnits,
} from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface DraftEstimateLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  incomeAccountId: string;
  taxJurisdictionId?: string | null;
}

interface CreateEstimateDraftOptions {
  bookId: string;
  customerId: string;
  number: string;
  estimateDate: string;
  expiryDate?: string | null;
  memo?: string | null;
  terms?: string | null;
  lines: DraftEstimateLineInput[];
}

interface CreateEstimateDraftResult {
  estimateId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create a draft estimate (quote) with line items. Records the pre-tax subtotal;
 * an estimate has no ledger effect until it is converted into an invoice
 */
export const createEstimateDraft = async (
  opts: CreateEstimateDraftOptions,
): Promise<CreateEstimateDraftResult> => {
  const {
    bookId,
    customerId,
    number,
    estimateDate,
    expiryDate,
    memo,
    terms,
    lines,
  } = opts;

  if (lines.length === 0) {
    throw new Error("An estimate needs at least one line");
  }

  const priced = lines.map((line, index) => ({
    ...line,
    amount: computeLineAmount(line.quantity, line.unitPrice),
    sortOrder: index,
  }));

  let subtotalUnits = 0;
  for (const line of priced) subtotalUnits += toUnits(line.amount);
  const subtotal = fromUnits(subtotalUnits);

  return dbPool.transaction(async (tx) => {
    const [estimateRow] = await tx
      .insert(estimateTable)
      .values({
        bookId,
        customerId,
        number,
        status: "draft",
        estimateDate,
        expiryDate: expiryDate ?? null,
        subtotal: subtotal.toFixed(4),
        total: subtotal.toFixed(4),
        memo: memo ?? null,
        terms: terms ?? null,
      } satisfies InferInsertModel<typeof estimateTable>)
      .returning();
    if (!estimateRow) {
      throw new Error("Failed to create the estimate");
    }

    for (const line of priced) {
      await tx.insert(estimateLineTable).values({
        estimateId: estimateRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        incomeAccountId: line.incomeAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof estimateLineTable>);
    }

    return {
      estimateId: estimateRow.id,
      number,
      subtotal,
      lineCount: priced.length,
    };
  });
};
