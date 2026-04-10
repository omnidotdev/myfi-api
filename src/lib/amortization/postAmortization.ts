import { and, eq, sql } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  amortizationEntryTable,
  journalEntryTable,
  journalLineTable,
  loanTable,
  reconciliationQueueTable,
} from "lib/db/schema";

import type { InferInsertModel } from "drizzle-orm";

/**
 * Post amortization journal entries for all active loans in a book for a
 * given year/month. Idempotent (skips entries that already have a journal
 * entry for the target period via sourceReferenceId).
 */
const postAmortization = async (
  bookId: string,
  year: number,
  month: number,
) => {
  const loans = await dbPool
    .select()
    .from(loanTable)
    .where(and(eq(loanTable.bookId, bookId), eq(loanTable.status, "active")));

  let postedCount = 0;
  let skippedCount = 0;

  for (const loan of loans) {
    const dueDatePrefix = `${year}-${String(month).padStart(2, "0")}`;

    const entries = await dbPool
      .select()
      .from(amortizationEntryTable)
      .where(
        and(
          eq(amortizationEntryTable.loanId, loan.id),
          eq(amortizationEntryTable.status, "scheduled"),
          sql`${amortizationEntryTable.dueDate} LIKE ${`${dueDatePrefix}%`}`,
        ),
      );

    for (const entry of entries) {
      const sourceReferenceId = `${loan.id}:amort:${entry.sequenceNumber}`;

      // Idempotency check
      const [existing] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(
          and(
            eq(journalEntryTable.bookId, bookId),
            eq(journalEntryTable.source, "amortization"),
            eq(journalEntryTable.sourceReferenceId, sourceReferenceId),
          ),
        );

      if (existing) {
        skippedCount++;
        continue;
      }

      await dbPool.transaction(async (tx) => {
        const [journalEntry] = await tx
          .insert(journalEntryTable)
          .values({
            bookId,
            date: `${entry.dueDate}T00:00:00.000000+00`,
            memo: `Loan payment #${entry.sequenceNumber}: ${loan.name}`,
            source: "amortization",
            sourceReferenceId,
            isReviewed: true,
          } satisfies InferInsertModel<typeof journalEntryTable>)
          .returning();

        const principalTotal =
          Number(entry.principalAmount) + Number(entry.extraPrincipal);
        const totalPayment =
          Number(entry.paymentAmount) + Number(entry.extraPrincipal);

        await tx.insert(journalLineTable).values([
          {
            journalEntryId: journalEntry.id,
            accountId: loan.interestAccountId,
            debit: entry.interestAmount,
            credit: "0.0000",
            memo: "Interest",
          } satisfies InferInsertModel<typeof journalLineTable>,
          {
            journalEntryId: journalEntry.id,
            accountId: loan.liabilityAccountId,
            debit: principalTotal.toFixed(4),
            credit: "0.0000",
            memo: "Principal",
          } satisfies InferInsertModel<typeof journalLineTable>,
          {
            journalEntryId: journalEntry.id,
            accountId: loan.paymentAccountId,
            debit: "0.0000",
            credit: totalPayment.toFixed(4),
            memo: "Payment",
          } satisfies InferInsertModel<typeof journalLineTable>,
        ]);

        await tx.insert(reconciliationQueueTable).values({
          bookId,
          journalEntryId: journalEntry.id,
          status: "approved",
          categorizationSource: "rule",
          confidence: "1.00",
          priority: 0,
          periodYear: year,
          periodMonth: month,
        } satisfies InferInsertModel<typeof reconciliationQueueTable>);

        await tx
          .update(amortizationEntryTable)
          .set({
            status: "posted",
            journalEntryId: journalEntry.id,
          })
          .where(eq(amortizationEntryTable.id, entry.id));
      });

      emitAudit({
        type: "myfi.loan.payment_posted",
        organizationId: bookId,
        actor: SYSTEM_ACTOR,
        resource: { type: "loan", id: loan.id, name: loan.name },
        data: {
          sequenceNumber: entry.sequenceNumber,
          principal: entry.principalAmount,
          interest: entry.interestAmount,
          year,
          month,
        },
      });

      postedCount++;
    }
  }

  return { postedCount, skippedCount };
};

export default postAmortization;
