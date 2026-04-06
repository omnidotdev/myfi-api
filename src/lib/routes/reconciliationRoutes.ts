import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { learnRule } from "lib/categorization";
import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";

// Reconciliation queue routes
const reconciliationRoutes = new Elysia({ prefix: "/api/reconciliation" })
  .get("/", async ({ query, set }) => {
    const { bookId, periodYear, periodMonth } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const conditions = [eq(reconciliationQueueTable.bookId, bookId)];

    if (periodYear) {
      conditions.push(
        eq(reconciliationQueueTable.periodYear, Number(periodYear)),
      );
    }

    if (periodMonth) {
      conditions.push(
        eq(reconciliationQueueTable.periodMonth, Number(periodMonth)),
      );
    }

    const items = await dbPool
      .select()
      .from(reconciliationQueueTable)
      .where(and(...conditions))
      .orderBy(desc(reconciliationQueueTable.priority));

    return { items };
  })
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select()
        .from(reconciliationQueueTable)
        .where(eq(reconciliationQueueTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Reconciliation item not found" };
      }

      const { status, reviewedBy, debitAccountId, creditAccountId } = body;
      const hasCorrectionAccounts = debitAccountId && creditAccountId;

      // If correction accounts are provided, update journal lines and learn
      if (hasCorrectionAccounts && existing.journalEntryId) {
        const lines = await dbPool
          .select()
          .from(journalLineTable)
          .where(eq(journalLineTable.journalEntryId, existing.journalEntryId));

        // Update debit line (line with non-zero debit)
        const debitLine = lines.find((l) => l.debit !== "0");
        if (debitLine) {
          await dbPool
            .update(journalLineTable)
            .set({ accountId: debitAccountId })
            .where(eq(journalLineTable.id, debitLine.id));
        }

        // Update credit line (line with non-zero credit)
        const creditLine = lines.find((l) => l.credit !== "0");
        if (creditLine) {
          await dbPool
            .update(journalLineTable)
            .set({ accountId: creditAccountId })
            .where(eq(journalLineTable.id, creditLine.id));
        }

        // Fetch merchant name from journal entry memo
        const [entry] = await dbPool
          .select({ memo: journalEntryTable.memo })
          .from(journalEntryTable)
          .where(eq(journalEntryTable.id, existing.journalEntryId));

        if (entry?.memo) {
          await learnRule(
            existing.bookId,
            entry.memo,
            debitAccountId,
            creditAccountId,
          );
        }
      } else if (status === "approved" && existing.journalEntryId) {
        // Reinforce existing categorization on approval
        const lines = await dbPool
          .select()
          .from(journalLineTable)
          .where(eq(journalLineTable.journalEntryId, existing.journalEntryId));

        const debitLine = lines.find((l) => l.debit !== "0");
        const creditLine = lines.find((l) => l.credit !== "0");

        if (debitLine && creditLine) {
          const [entry] = await dbPool
            .select({ memo: journalEntryTable.memo })
            .from(journalEntryTable)
            .where(eq(journalEntryTable.id, existing.journalEntryId));

          if (entry?.memo) {
            await learnRule(
              existing.bookId,
              entry.memo,
              debitLine.accountId,
              creditLine.accountId,
            );
          }
        }
      }

      const [item] = await dbPool
        .update(reconciliationQueueTable)
        .set({
          status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewedBy ?? null,
        })
        .where(eq(reconciliationQueueTable.id, id))
        .returning();

      const auditType =
        body.debitAccountId && body.creditAccountId
          ? "myfi.reconciliation.corrected"
          : body.status === "approved"
            ? "myfi.reconciliation.approved"
            : body.status === "rejected"
              ? "myfi.reconciliation.rejected"
              : "myfi.reconciliation.adjusted";

      emitAudit({
        type: auditType,
        organizationId: existing.bookId,
        actor: body.reviewedBy ? { id: body.reviewedBy } : { id: "unknown" },
        resource: { type: "reconciliation", id },
        data: {
          journalEntryId: existing.journalEntryId,
          status: body.status,
          ...(body.debitAccountId
            ? {
                debitAccountId: body.debitAccountId,
                creditAccountId: body.creditAccountId,
              }
            : {}),
        },
      });

      return { item };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([
          t.Literal("approved"),
          t.Literal("adjusted"),
          t.Literal("rejected"),
        ]),
        reviewedBy: t.Optional(t.String()),
        debitAccountId: t.Optional(t.String()),
        creditAccountId: t.Optional(t.String()),
      }),
    },
  );

export default reconciliationRoutes;
