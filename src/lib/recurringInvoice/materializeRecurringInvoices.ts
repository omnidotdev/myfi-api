import { and, eq, lte } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  invoiceTable,
  recurringInvoiceLineTable,
  recurringInvoiceTable,
} from "lib/db/schema";
import { createInvoiceDraft } from "lib/invoicing/createInvoiceDraft";
import { advanceDate } from "lib/recurring/advanceDate";

import type {
  SelectRecurringInvoice,
  SelectRecurringInvoiceLine,
} from "lib/db/schema";
import type { RecurringFrequency } from "lib/recurring/advanceDate";

/** Cap on catch-up occurrences per run, so a long-dormant template cannot
 * generate an unbounded number of drafts in one pass */
const MAX_CATCHUP = 60;

/** Add whole days to a YYYY-MM-DD date, returning a YYYY-MM-DD date */
const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};

interface MaterializeTemplateResult {
  recurringInvoiceId: string;
  generated: number;
  nextRunDate: string;
}

interface MaterializeResult {
  /** Total draft invoices generated across every template this run */
  generated: number;
  perTemplate: MaterializeTemplateResult[];
}

/**
 * Generate every due draft invoice for a single template up to asOf, then leave
 * its nextRunDate past asOf. For each scheduled date at or before asOf a draft
 * invoice is created at issueDate = that date, dueDate = issueDate + dueInDays,
 * carrying the template's lines, then the schedule advances by its frequency.
 * Idempotent: the guard is advancing nextRunDate past asOf, so a re-run as of
 * the same date generates nothing. The per-book unique invoice number (prefix +
 * issue date) is a second guard, so a template already carrying a draft for a
 * date skips it rather than failing
 */
const materializeTemplate = async (
  template: SelectRecurringInvoice,
  lines: SelectRecurringInvoiceLine[],
  asOf: string,
): Promise<MaterializeTemplateResult> => {
  let runDate = template.nextRunDate;
  let generated = 0;

  const frequency = template.frequency as RecurringFrequency;

  while (runDate <= asOf && generated < MAX_CATCHUP) {
    const number = `${template.numberPrefix}${runDate}`;

    const [existing] = await dbPool
      .select({ id: invoiceTable.id })
      .from(invoiceTable)
      .where(
        and(
          eq(invoiceTable.bookId, template.bookId),
          eq(invoiceTable.number, number),
        ),
      );

    if (!existing) {
      await createInvoiceDraft({
        bookId: template.bookId,
        customerId: template.customerId,
        number,
        issueDate: runDate,
        dueDate: addDays(runDate, template.dueInDays),
        memo: template.memo,
        currency: template.currency,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          incomeAccountId: line.incomeAccountId,
          taxJurisdictionId: line.taxJurisdictionId,
          discountPercent:
            line.discountPercent != null ? Number(line.discountPercent) : null,
        })),
      });
      generated += 1;
    }

    runDate = advanceDate(runDate, frequency);
  }

  await dbPool
    .update(recurringInvoiceTable)
    .set({ nextRunDate: runDate, updatedAt: new Date().toISOString() })
    .where(eq(recurringInvoiceTable.id, template.id));

  return { recurringInvoiceId: template.id, generated, nextRunDate: runDate };
};

/**
 * Materialize all active recurring-invoice templates that have come due (through
 * asOf), optionally scoped to one book. Each due template generates one or more
 * draft invoices (catching up any missed occurrences) and advances its schedule.
 * The drafts are not posted to the ledger; a user posts them through the normal
 * invoice flow. Returns the total generated and a per-template breakdown
 */
export const materializeRecurringInvoices = async (opts: {
  asOf: string;
  bookId?: string;
}): Promise<MaterializeResult> => {
  const { asOf, bookId } = opts;

  const due = await dbPool
    .select()
    .from(recurringInvoiceTable)
    .where(
      bookId
        ? and(
            eq(recurringInvoiceTable.bookId, bookId),
            eq(recurringInvoiceTable.isActive, true),
            lte(recurringInvoiceTable.nextRunDate, asOf),
          )
        : and(
            eq(recurringInvoiceTable.isActive, true),
            lte(recurringInvoiceTable.nextRunDate, asOf),
          ),
    );

  const perTemplate: MaterializeTemplateResult[] = [];
  for (const template of due) {
    const lines = await dbPool
      .select()
      .from(recurringInvoiceLineTable)
      .where(eq(recurringInvoiceLineTable.recurringInvoiceId, template.id))
      .orderBy(recurringInvoiceLineTable.sortOrder);
    // A template with no lines cannot produce a valid invoice; advance it past
    // asOf anyway so it is not re-scanned every run
    if (lines.length === 0) {
      const advanced = advanceDate(
        template.nextRunDate,
        template.frequency as RecurringFrequency,
      );
      await dbPool
        .update(recurringInvoiceTable)
        .set({ nextRunDate: advanced, updatedAt: new Date().toISOString() })
        .where(eq(recurringInvoiceTable.id, template.id));
      perTemplate.push({
        recurringInvoiceId: template.id,
        generated: 0,
        nextRunDate: advanced,
      });
      continue;
    }
    perTemplate.push(await materializeTemplate(template, lines, asOf));
  }

  const generated = perTemplate.reduce((sum, r) => sum + r.generated, 0);
  return { generated, perTemplate };
};
