import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { calculateSchedule, postAmortization } from "lib/amortization";
import { emitAudit } from "lib/audit";
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
 * Compute current balance for a loan: originalPrincipal minus sum of posted
 * principal amounts from amortization entries.
 */
const getCurrentBalance = async (loan: {
  id: string;
  originalPrincipal: string;
}): Promise<number> => {
  const [result] = await dbPool
    .select({
      total: sql<string>`coalesce(sum(${amortizationEntryTable.principalAmount}::numeric + ${amortizationEntryTable.extraPrincipal}::numeric), 0)`,
    })
    .from(amortizationEntryTable)
    .where(
      and(
        eq(amortizationEntryTable.loanId, loan.id),
        eq(amortizationEntryTable.status, "posted"),
      ),
    );

  return Number(loan.originalPrincipal) - Number(result?.total ?? 0);
};

// Loan CRUD routes with amortization schedule management
const loanRoutes = new Elysia({ prefix: "/api/loans" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const loans = await dbPool
      .select()
      .from(loanTable)
      .where(eq(loanTable.bookId, bookId));

    const enriched = await Promise.all(
      loans.map(async (loan) => {
        const currentBalance = await getCurrentBalance(loan);
        return { ...loan, currentBalance };
      }),
    );

    return { loans: enriched };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [loan] = await dbPool
        .insert(loanTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          liabilityAccountId: body.liabilityAccountId,
          interestAccountId: body.interestAccountId,
          paymentAccountId: body.paymentAccountId,
          originalPrincipal: body.originalPrincipal,
          annualRate: body.annualRate,
          termMonths: body.termMonths,
          startDate: body.startDate,
          paymentDay: body.paymentDay,
          paymentAmount: body.paymentAmount ?? null,
          extraPrincipal: body.extraPrincipal ?? "0.0000",
          notes: body.notes ?? null,
        })
        .returning();

      // Generate full amortization schedule
      const schedule = calculateSchedule({
        principal: Number(body.originalPrincipal),
        annualRate: Number(body.annualRate),
        termMonths: body.termMonths,
        startDate: body.startDate,
        paymentDay: body.paymentDay,
        paymentAmount: body.paymentAmount ? Number(body.paymentAmount) : null,
        extraPrincipal: body.extraPrincipal
          ? Number(body.extraPrincipal)
          : undefined,
      });

      if (schedule.length > 0) {
        await dbPool.insert(amortizationEntryTable).values(
          schedule.map((entry) => ({
            loanId: loan.id,
            sequenceNumber: entry.sequenceNumber,
            dueDate: entry.dueDate,
            paymentAmount: entry.paymentAmount.toFixed(4),
            principalAmount: entry.principalAmount.toFixed(4),
            interestAmount: entry.interestAmount.toFixed(4),
            extraPrincipal: entry.extraPrincipal.toFixed(4),
            balanceAfter: entry.balanceAfter.toFixed(4),
          })),
        );
      }

      set.status = 201;

      emitAudit({
        type: "myfi.loan.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "loan", id: loan.id, name: loan.name },
        data: { bookId: body.bookId },
      });

      return { loan, scheduleCount: schedule.length };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        liabilityAccountId: t.String(),
        interestAccountId: t.String(),
        paymentAccountId: t.String(),
        originalPrincipal: t.String(),
        annualRate: t.String(),
        termMonths: t.Number(),
        startDate: t.String(),
        paymentDay: t.Number(),
        paymentAmount: t.Optional(t.String()),
        extraPrincipal: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select()
        .from(loanTable)
        .where(eq(loanTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Loan not found" };
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.paymentAmount !== undefined)
        updates.paymentAmount = body.paymentAmount;
      if (body.extraPrincipal !== undefined)
        updates.extraPrincipal = body.extraPrincipal;
      if (body.status !== undefined) updates.status = body.status;
      updates.updatedAt = new Date().toISOString();

      const [loan] = await dbPool
        .update(loanTable)
        .set(updates)
        .where(eq(loanTable.id, id))
        .returning();

      // Regenerate schedule if payment terms changed
      const paymentChanged =
        body.paymentAmount !== undefined || body.extraPrincipal !== undefined;

      if (paymentChanged) {
        // Delete all scheduled (unposted) entries
        await dbPool
          .delete(amortizationEntryTable)
          .where(
            and(
              eq(amortizationEntryTable.loanId, id),
              eq(amortizationEntryTable.status, "scheduled"),
            ),
          );

        // Find the last posted entry to get remaining balance
        const [lastPosted] = await dbPool
          .select()
          .from(amortizationEntryTable)
          .where(
            and(
              eq(amortizationEntryTable.loanId, id),
              eq(amortizationEntryTable.status, "posted"),
            ),
          )
          .orderBy(desc(amortizationEntryTable.sequenceNumber))
          .limit(1);

        const remainingBalance = lastPosted
          ? Number(lastPosted.balanceAfter)
          : Number(loan.originalPrincipal);
        const lastSequence = lastPosted ? lastPosted.sequenceNumber : 0;
        const remainingTerm = loan.termMonths - lastSequence;

        if (remainingBalance > 0.005 && remainingTerm > 0) {
          const schedule = calculateSchedule({
            principal: remainingBalance,
            annualRate: Number(loan.annualRate),
            termMonths: remainingTerm,
            startDate: loan.startDate,
            paymentDay: loan.paymentDay,
            paymentAmount: loan.paymentAmount
              ? Number(loan.paymentAmount)
              : null,
            extraPrincipal: loan.extraPrincipal
              ? Number(loan.extraPrincipal)
              : undefined,
          });

          if (schedule.length > 0) {
            await dbPool.insert(amortizationEntryTable).values(
              schedule.map((entry) => ({
                loanId: id,
                // Offset sequence numbers to continue from last posted
                sequenceNumber: lastSequence + entry.sequenceNumber,
                dueDate: entry.dueDate,
                paymentAmount: entry.paymentAmount.toFixed(4),
                principalAmount: entry.principalAmount.toFixed(4),
                interestAmount: entry.interestAmount.toFixed(4),
                extraPrincipal: entry.extraPrincipal.toFixed(4),
                balanceAfter: entry.balanceAfter.toFixed(4),
              })),
            );
          }
        }
      }

      emitAudit({
        type: "myfi.loan.updated",
        organizationId: existing.bookId,
        actor: { id: "unknown" },
        resource: { type: "loan", id: loan.id, name: loan.name },
        data: { updatedFields: Object.keys(updates) },
      });

      return { loan };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        paymentAmount: t.Optional(t.String()),
        extraPrincipal: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [loan] = await dbPool
        .select()
        .from(loanTable)
        .where(eq(loanTable.id, id));

      if (!loan) {
        set.status = 404;
        return { error: "Loan not found" };
      }

      // Check for posted entries
      const [postedEntry] = await dbPool
        .select({ id: amortizationEntryTable.id })
        .from(amortizationEntryTable)
        .where(
          and(
            eq(amortizationEntryTable.loanId, id),
            eq(amortizationEntryTable.status, "posted"),
          ),
        )
        .limit(1);

      if (postedEntry) {
        set.status = 409;
        return { error: "Cannot delete loan with posted entries" };
      }

      await dbPool.delete(loanTable).where(eq(loanTable.id, id));

      emitAudit({
        type: "myfi.loan.deleted",
        organizationId: loan.bookId,
        actor: { id: "unknown" },
        resource: { type: "loan", id: loan.id, name: loan.name },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:id/schedule",
    async ({ params, set }) => {
      const { id } = params;

      const [loan] = await dbPool
        .select({ id: loanTable.id })
        .from(loanTable)
        .where(eq(loanTable.id, id));

      if (!loan) {
        set.status = 404;
        return { error: "Loan not found" };
      }

      const schedule = await dbPool
        .select()
        .from(amortizationEntryTable)
        .where(eq(amortizationEntryTable.loanId, id))
        .orderBy(amortizationEntryTable.sequenceNumber);

      return { schedule };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/payoff",
    async ({ params, body, set }) => {
      const { id } = params;

      const [loan] = await dbPool
        .select()
        .from(loanTable)
        .where(eq(loanTable.id, id));

      if (!loan) {
        set.status = 404;
        return { error: "Loan not found" };
      }

      if (loan.status === "paid_off") {
        set.status = 409;
        return { error: "Loan is already paid off" };
      }

      const currentBalance = await getCurrentBalance(loan);

      const { journalEntry, updatedLoan } = await dbPool.transaction(
        async (tx) => {
          const payoffDate = `${body.payoffDate}T00:00:00.000000+00`;
          const payoffAmount = Number(body.payoffAmount);

          // Create payoff journal entry
          const [entry] = await tx
            .insert(journalEntryTable)
            .values({
              bookId: loan.bookId,
              date: payoffDate,
              memo: `Loan payoff: ${loan.name}`,
              source: "amortization",
              sourceReferenceId: `${loan.id}:payoff`,
              isReviewed: true,
            } satisfies InferInsertModel<typeof journalEntryTable>)
            .returning();

          // Debit liability (pay off remaining balance), credit bank
          const lines: InferInsertModel<typeof journalLineTable>[] = [
            {
              journalEntryId: entry.id,
              accountId: loan.liabilityAccountId,
              debit: currentBalance.toFixed(4),
              credit: "0.0000",
              memo: "Payoff principal",
            },
          ];

          // If payoff amount exceeds balance, the difference is interest
          const interestPortion = payoffAmount - currentBalance;
          if (interestPortion > 0.005) {
            lines.push({
              journalEntryId: entry.id,
              accountId: loan.interestAccountId,
              debit: interestPortion.toFixed(4),
              credit: "0.0000",
              memo: "Payoff interest",
            });
          }

          lines.push({
            journalEntryId: entry.id,
            accountId: body.payoffAccountId,
            debit: "0.0000",
            credit: payoffAmount.toFixed(4),
            memo: "Payoff payment",
          });

          await tx.insert(journalLineTable).values(lines);

          await tx.insert(reconciliationQueueTable).values({
            bookId: loan.bookId,
            journalEntryId: entry.id,
            status: "approved",
            categorizationSource: "rule",
            confidence: "1.00",
            priority: 0,
            periodYear: new Date(body.payoffDate).getFullYear(),
            periodMonth: new Date(body.payoffDate).getMonth() + 1,
          } satisfies InferInsertModel<typeof reconciliationQueueTable>);

          // Mark remaining scheduled entries as skipped
          await tx
            .update(amortizationEntryTable)
            .set({ status: "skipped" })
            .where(
              and(
                eq(amortizationEntryTable.loanId, id),
                eq(amortizationEntryTable.status, "scheduled"),
              ),
            );

          // Mark loan as paid off
          const [updated] = await tx
            .update(loanTable)
            .set({
              status: "paid_off",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(loanTable.id, id))
            .returning();

          return { journalEntry: entry, updatedLoan: updated };
        },
      );

      emitAudit({
        type: "myfi.loan.paid_off",
        organizationId: loan.bookId,
        actor: { id: "unknown" },
        resource: { type: "loan", id: loan.id, name: loan.name },
        data: {
          payoffDate: body.payoffDate,
          payoffAmount: body.payoffAmount,
          remainingBalance: currentBalance,
        },
      });

      return { loan: updatedLoan, journalEntry };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        payoffDate: t.String(),
        payoffAmount: t.String(),
        payoffAccountId: t.String(),
      }),
    },
  )
  .post(
    "/run-amortization",
    async ({ body }) => {
      const result = await postAmortization(body.bookId, body.year, body.month);
      return { result };
    },
    {
      body: t.Object({
        bookId: t.String(),
        year: t.Number(),
        month: t.Number(),
      }),
    },
  );

export { getCurrentBalance };
export default loanRoutes;
