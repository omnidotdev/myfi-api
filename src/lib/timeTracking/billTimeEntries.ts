import { and, eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { timeEntryTable } from "lib/db/schema";
import { createInvoiceDraft } from "lib/invoicing/createInvoiceDraft";

interface BillTimeEntriesOptions {
  bookId: string;
  customerId: string;
  entryIds: string[];
  number: string;
  issueDate: string;
  dueDate: string;
  /** revenue account the billed time posts to */
  incomeAccountId: string;
}

interface BillTimeEntriesResult {
  invoiceId: string;
  lineCount: number;
}

/**
 * Bill selected time entries onto a new draft invoice: each entry becomes a
 * line (quantity = hours, unit price = rate) and is stamped with the invoice id
 * so it cannot be billed again. All entries must belong to the book and the
 * given customer, be billable, and not already be billed
 */
export const billTimeEntries = async (
  opts: BillTimeEntriesOptions,
): Promise<BillTimeEntriesResult> => {
  const {
    bookId,
    customerId,
    entryIds,
    number,
    issueDate,
    dueDate,
    incomeAccountId,
  } = opts;

  if (entryIds.length === 0) {
    throw new Error("Select at least one time entry to bill");
  }

  const entries = await dbPool
    .select()
    .from(timeEntryTable)
    .where(inArray(timeEntryTable.id, entryIds));

  const valid =
    entries.length === entryIds.length &&
    entries.every(
      (e) =>
        e.bookId === bookId &&
        e.customerId === customerId &&
        e.billable &&
        e.invoiceId === null,
    );
  if (!valid) {
    throw new Error("One or more time entries are not available to bill");
  }

  const draft = await createInvoiceDraft({
    bookId,
    customerId,
    number,
    issueDate,
    dueDate,
    lines: entries.map((e) => ({
      description: e.description ?? "Time",
      quantity: Number(e.hours),
      unitPrice: Number(e.rate),
      incomeAccountId,
    })),
  });

  await dbPool
    .update(timeEntryTable)
    .set({ invoiceId: draft.invoiceId, updatedAt: new Date().toISOString() })
    .where(
      and(
        inArray(timeEntryTable.id, entryIds),
        eq(timeEntryTable.bookId, bookId),
      ),
    );

  return { invoiceId: draft.invoiceId, lineCount: draft.lineCount };
};
