import { dbPool } from "lib/db/db";
import { billLineTable, billTable } from "lib/db/schema";
import {
  computeLineAmount,
  fromUnits,
  toUnits,
} from "lib/invoicing/invoicePosting";

import type { InferInsertModel } from "drizzle-orm";

interface DraftBillLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  expenseAccountId: string;
  taxJurisdictionId?: string | null;
}

interface CreateBillDraftOptions {
  bookId: string;
  vendorId: string;
  number: string;
  billDate: string;
  dueDate: string;
  memo?: string | null;
  lines: DraftBillLineInput[];
}

interface CreateBillDraftResult {
  billId: string;
  number: string;
  subtotal: number;
  lineCount: number;
}

/**
 * Create a draft bill with its line items. Records the pre-tax subtotal; tax and
 * the final total are computed when the bill is posted. Mirror of
 * createInvoiceDraft
 */
export const createBillDraft = async (
  opts: CreateBillDraftOptions,
): Promise<CreateBillDraftResult> => {
  const { bookId, vendorId, number, billDate, dueDate, memo, lines } = opts;

  if (lines.length === 0) {
    throw new Error("A bill needs at least one line");
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
    const [billRow] = await tx
      .insert(billTable)
      .values({
        bookId,
        vendorId,
        number,
        status: "draft",
        billDate,
        dueDate,
        subtotal: subtotal.toFixed(4),
        taxAmount: "0.0000",
        total: subtotal.toFixed(4),
        memo: memo ?? null,
      } satisfies InferInsertModel<typeof billTable>)
      .returning();
    if (!billRow) {
      throw new Error("Failed to create the bill");
    }

    for (const line of priced) {
      await tx.insert(billLineTable).values({
        billId: billRow.id,
        description: line.description,
        quantity: line.quantity.toFixed(4),
        unitPrice: line.unitPrice.toFixed(4),
        amount: line.amount.toFixed(4),
        expenseAccountId: line.expenseAccountId,
        taxJurisdictionId: line.taxJurisdictionId ?? null,
        sortOrder: line.sortOrder,
      } satisfies InferInsertModel<typeof billLineTable>);
    }

    return { billId: billRow.id, number, subtotal, lineCount: priced.length };
  });
};
