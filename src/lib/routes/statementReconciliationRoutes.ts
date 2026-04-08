import { and, desc, eq, lte } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  reconciliationStatementTable,
} from "lib/db/schema";

const statementReconciliationRoutes = new Elysia({
  prefix: "/api/statement-reconciliations",
})
  // List reconciliations for a book
  .get("/", async ({ query, set }) => {
    const { bookId, accountId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const conditions = [eq(reconciliationStatementTable.bookId, bookId)];

    if (accountId) {
      conditions.push(eq(reconciliationStatementTable.accountId, accountId));
    }

    const reconciliations = await dbPool
      .select()
      .from(reconciliationStatementTable)
      .where(and(...conditions))
      .orderBy(desc(reconciliationStatementTable.createdAt));

    return { reconciliations };
  })
  // Start new reconciliation
  .post(
    "/",
    async ({ body }) => {
      const { bookId, accountId, statementDate, statementBalance } = body;

      // Look up previous completed reconciliation for beginning balance
      const [previous] = await dbPool
        .select()
        .from(reconciliationStatementTable)
        .where(
          and(
            eq(reconciliationStatementTable.bookId, bookId),
            eq(reconciliationStatementTable.accountId, accountId),
            eq(reconciliationStatementTable.status, "completed"),
          ),
        )
        .orderBy(desc(reconciliationStatementTable.createdAt));

      const beginningBalance = previous?.statementBalance ?? "0";

      const [reconciliation] = await dbPool
        .insert(reconciliationStatementTable)
        .values({
          bookId,
          accountId,
          statementDate,
          statementBalance,
          beginningBalance,
          status: "in_progress",
        })
        .returning();

      return { reconciliation };
    },
    {
      body: t.Object({
        bookId: t.String(),
        accountId: t.String(),
        statementDate: t.String(),
        statementBalance: t.String(),
      }),
    },
  )
  // Get reconciliation detail with lines
  .get("/:id", async ({ params, set }) => {
    const { id } = params;

    const [reconciliation] = await dbPool
      .select()
      .from(reconciliationStatementTable)
      .where(eq(reconciliationStatementTable.id, id));

    if (!reconciliation) {
      set.status = 404;
      return { error: "Reconciliation not found" };
    }

    // Fetch journal lines for this account up to statement date
    const lines = await dbPool
      .select({
        lineId: journalLineTable.id,
        journalEntryId: journalLineTable.journalEntryId,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
        cleared: journalLineTable.cleared,
        memo: journalLineTable.memo,
        entryDate: journalEntryTable.date,
        entryMemo: journalEntryTable.memo,
        source: journalEntryTable.source,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .where(
        and(
          eq(journalLineTable.accountId, reconciliation.accountId),
          eq(journalEntryTable.bookId, reconciliation.bookId),
          lte(journalEntryTable.date, reconciliation.statementDate),
        ),
      )
      .orderBy(journalEntryTable.date);

    // Calculate cleared balance
    // For asset accounts: amount = debit - credit
    const beginNum = Number(reconciliation.beginningBalance);
    let clearedSum = 0;

    for (const line of lines) {
      if (line.cleared) {
        clearedSum += Number(line.debit ?? 0) - Number(line.credit ?? 0);
      }
    }

    const clearedBalance = beginNum + clearedSum;
    const difference = Number(reconciliation.statementBalance) - clearedBalance;

    return {
      reconciliation,
      lines,
      clearedBalance: clearedBalance.toFixed(4),
      difference: difference.toFixed(4),
    };
  })
  // Toggle cleared status on a line
  .patch(
    "/:id/lines/:lineId",
    async ({ params, body, set }) => {
      const { id, lineId } = params;

      const [reconciliation] = await dbPool
        .select()
        .from(reconciliationStatementTable)
        .where(eq(reconciliationStatementTable.id, id));

      if (!reconciliation) {
        set.status = 404;
        return { error: "Reconciliation not found" };
      }

      if (reconciliation.status === "completed") {
        set.status = 409;
        return { error: "Reconciliation is already completed" };
      }

      await dbPool
        .update(journalLineTable)
        .set({ cleared: body.cleared })
        .where(eq(journalLineTable.id, lineId));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String(), lineId: t.String() }),
      body: t.Object({ cleared: t.Boolean() }),
    },
  )
  // Complete reconciliation
  .post("/:id/complete", async ({ params, set }) => {
    const { id } = params;

    const [existing] = await dbPool
      .select()
      .from(reconciliationStatementTable)
      .where(eq(reconciliationStatementTable.id, id));

    if (!existing) {
      set.status = 404;
      return { error: "Reconciliation not found" };
    }

    if (existing.status === "completed") {
      set.status = 409;
      return { error: "Reconciliation is already completed" };
    }

    const [reconciliation] = await dbPool
      .update(reconciliationStatementTable)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
        discrepancy: "0",
      })
      .where(eq(reconciliationStatementTable.id, id))
      .returning();

    emitAudit({
      type: "myfi.statement_reconciliation.completed",
      organizationId: existing.bookId,
      actor: { id: "unknown" },
      resource: {
        type: "statement_reconciliation",
        id,
      },
      data: {
        accountId: existing.accountId,
        statementDate: existing.statementDate,
        statementBalance: existing.statementBalance,
      },
    });

    return { reconciliation };
  });

export default statementReconciliationRoutes;
