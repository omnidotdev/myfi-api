import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  recurringInvoiceLineTable,
  recurringInvoiceTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";
import type {
  SelectRecurringInvoice,
  SelectRecurringInvoiceLine,
} from "lib/db/schema";
import type { RecurringFrequency } from "lib/recurring/advanceDate";

/** Frequencies a template may use, matching the advanceDate helper's vocabulary */
const RECURRING_INVOICE_FREQUENCIES: RecurringFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface RecurringInvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  incomeAccountId: string;
  taxJurisdictionId?: string | null;
  discountPercent?: number | null;
}

interface CreateRecurringInvoiceInput {
  bookId: string;
  customerId: string;
  numberPrefix?: string;
  frequency: string;
  nextRunDate: string;
  dueInDays?: number;
  currency?: string;
  memo?: string | null;
  lines: RecurringInvoiceLineInput[];
}

interface RecurringInvoiceWithLines {
  template: SelectRecurringInvoice;
  lines: SelectRecurringInvoiceLine[];
}

const assertValidTemplate = (opts: {
  frequency: string;
  nextRunDate: string;
  lines: RecurringInvoiceLineInput[];
}): void => {
  if (!RECURRING_INVOICE_FREQUENCIES.includes(opts.frequency as never)) {
    throw new Error("Invalid frequency");
  }
  if (!ISO_DATE.test(opts.nextRunDate)) {
    throw new Error("nextRunDate must be a YYYY-MM-DD date");
  }
  if (opts.lines.length === 0) {
    throw new Error("A recurring invoice needs at least one line");
  }
};

/**
 * Create a recurring-invoice template with its line items in one transaction.
 * The template generates draft invoices on its schedule; nothing posts here
 */
export const createRecurringInvoice = async (
  input: CreateRecurringInvoiceInput,
): Promise<RecurringInvoiceWithLines> => {
  assertValidTemplate(input);

  return dbPool.transaction(async (tx) => {
    const [template] = await tx
      .insert(recurringInvoiceTable)
      .values({
        bookId: input.bookId,
        customerId: input.customerId,
        frequency: input.frequency,
        nextRunDate: input.nextRunDate,
        ...(input.numberPrefix != null
          ? { numberPrefix: input.numberPrefix }
          : {}),
        ...(input.dueInDays != null ? { dueInDays: input.dueInDays } : {}),
        ...(input.currency != null ? { currency: input.currency } : {}),
        memo: input.memo ?? null,
      } satisfies InferInsertModel<typeof recurringInvoiceTable>)
      .returning();
    if (!template) {
      throw new Error("Failed to create the recurring invoice");
    }

    const lines = await tx
      .insert(recurringInvoiceLineTable)
      .values(
        input.lines.map((line, index) => ({
          recurringInvoiceId: template.id,
          description: line.description,
          quantity: line.quantity.toFixed(4),
          unitPrice: line.unitPrice.toFixed(4),
          incomeAccountId: line.incomeAccountId,
          taxJurisdictionId: line.taxJurisdictionId ?? null,
          discountPercent:
            line.discountPercent != null
              ? line.discountPercent.toFixed(6)
              : null,
          sortOrder: index,
        })) satisfies InferInsertModel<typeof recurringInvoiceLineTable>[],
      )
      .returning();

    return { template, lines };
  });
};

interface UpdateRecurringInvoiceInput {
  numberPrefix?: string;
  frequency?: string;
  nextRunDate?: string;
  dueInDays?: number;
  currency?: string;
  memo?: string | null;
  isActive?: boolean;
  /** when provided, replaces the template's lines wholesale */
  lines?: RecurringInvoiceLineInput[];
}

/**
 * Update a recurring-invoice template that belongs to bookId. Returns null when
 * no template with that id exists in the book. Passing lines replaces the whole
 * line set; omitting it leaves the existing lines untouched
 */
export const updateRecurringInvoice = async (
  id: string,
  bookId: string,
  input: UpdateRecurringInvoiceInput,
): Promise<RecurringInvoiceWithLines | null> => {
  const [existing] = await dbPool
    .select()
    .from(recurringInvoiceTable)
    .where(eq(recurringInvoiceTable.id, id));
  if (!existing || existing.bookId !== bookId) {
    return null;
  }

  if (
    input.frequency !== undefined &&
    !RECURRING_INVOICE_FREQUENCIES.includes(input.frequency as never)
  ) {
    throw new Error("Invalid frequency");
  }
  if (input.nextRunDate !== undefined && !ISO_DATE.test(input.nextRunDate)) {
    throw new Error("nextRunDate must be a YYYY-MM-DD date");
  }
  if (input.lines !== undefined && input.lines.length === 0) {
    throw new Error("A recurring invoice needs at least one line");
  }

  return dbPool.transaction(async (tx) => {
    const updates: Partial<InferInsertModel<typeof recurringInvoiceTable>> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.numberPrefix !== undefined)
      updates.numberPrefix = input.numberPrefix;
    if (input.frequency !== undefined) updates.frequency = input.frequency;
    if (input.nextRunDate !== undefined)
      updates.nextRunDate = input.nextRunDate;
    if (input.dueInDays !== undefined) updates.dueInDays = input.dueInDays;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.memo !== undefined) updates.memo = input.memo;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [template] = await tx
      .update(recurringInvoiceTable)
      .set(updates)
      .where(eq(recurringInvoiceTable.id, id))
      .returning();
    if (!template) {
      throw new Error("Failed to update the recurring invoice");
    }

    if (input.lines !== undefined) {
      await tx
        .delete(recurringInvoiceLineTable)
        .where(eq(recurringInvoiceLineTable.recurringInvoiceId, id));
      await tx.insert(recurringInvoiceLineTable).values(
        input.lines.map((line, index) => ({
          recurringInvoiceId: id,
          description: line.description,
          quantity: line.quantity.toFixed(4),
          unitPrice: line.unitPrice.toFixed(4),
          incomeAccountId: line.incomeAccountId,
          taxJurisdictionId: line.taxJurisdictionId ?? null,
          discountPercent:
            line.discountPercent != null
              ? line.discountPercent.toFixed(6)
              : null,
          sortOrder: index,
        })) satisfies InferInsertModel<typeof recurringInvoiceLineTable>[],
      );
    }

    const lines = await tx
      .select()
      .from(recurringInvoiceLineTable)
      .where(eq(recurringInvoiceLineTable.recurringInvoiceId, id))
      .orderBy(recurringInvoiceLineTable.sortOrder);

    return { template, lines };
  });
};

/** List a book's recurring-invoice templates, soonest next run first */
export const listRecurringInvoices = async (
  bookId: string,
): Promise<SelectRecurringInvoice[]> =>
  dbPool
    .select()
    .from(recurringInvoiceTable)
    .where(eq(recurringInvoiceTable.bookId, bookId))
    .orderBy(recurringInvoiceTable.nextRunDate);

/** Fetch one template with its lines, scoped to a book (IDOR guard) */
export const getRecurringInvoice = async (
  id: string,
  bookId: string,
): Promise<RecurringInvoiceWithLines | null> => {
  const [template] = await dbPool
    .select()
    .from(recurringInvoiceTable)
    .where(
      and(
        eq(recurringInvoiceTable.id, id),
        eq(recurringInvoiceTable.bookId, bookId),
      ),
    );
  if (!template) return null;
  const lines = await dbPool
    .select()
    .from(recurringInvoiceLineTable)
    .where(eq(recurringInvoiceLineTable.recurringInvoiceId, id))
    .orderBy(recurringInvoiceLineTable.sortOrder);
  return { template, lines };
};

/** Delete a template (its lines cascade). Returns false when not in the book */
export const deleteRecurringInvoice = async (
  id: string,
  bookId: string,
): Promise<boolean> => {
  const [existing] = await dbPool
    .select({ id: recurringInvoiceTable.id })
    .from(recurringInvoiceTable)
    .where(
      and(
        eq(recurringInvoiceTable.id, id),
        eq(recurringInvoiceTable.bookId, bookId),
      ),
    );
  if (!existing) return false;
  await dbPool
    .delete(recurringInvoiceTable)
    .where(eq(recurringInvoiceTable.id, id));
  return true;
};
