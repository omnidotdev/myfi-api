import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  accountingPeriodTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

import type { InsertJournalEntry } from "lib/db/schema";

/**
 * Check if a date falls within a closed accounting period for the given book
 */
const isPeriodLocked = async (
  bookId: string,
  date: string,
): Promise<boolean> => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const [period] = await dbPool
    .select({ status: accountingPeriodTable.status })
    .from(accountingPeriodTable)
    .where(
      and(
        eq(accountingPeriodTable.bookId, bookId),
        eq(accountingPeriodTable.year, year),
        eq(accountingPeriodTable.month, month),
      ),
    );

  return period?.status === "closed";
};

// Journal entry CRUD routes
const journalRoutes = new Elysia({ prefix: "/api/journal-entries" })
  .get("/", async ({ query, set }) => {
    const { bookId, limit, offset } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const take = limit ? Number.parseInt(limit, 10) : 50;
    const skip = offset ? Number.parseInt(offset, 10) : 0;

    // Fetch entries
    const entries = await dbPool
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.bookId, bookId))
      .orderBy(desc(journalEntryTable.date))
      .limit(take)
      .offset(skip);

    if (!entries.length) {
      return { entries: [] };
    }

    // Fetch lines with account names for all returned entries
    const entryIds = entries.map((e) => e.id);

    const lines = await dbPool
      .select({
        id: journalLineTable.id,
        journalEntryId: journalLineTable.journalEntryId,
        accountId: journalLineTable.accountId,
        accountName: accountTable.name,
        debit: journalLineTable.debit,
        credit: journalLineTable.credit,
        memo: journalLineTable.memo,
      })
      .from(journalLineTable)
      .leftJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
      .where(sql`${journalLineTable.journalEntryId} IN ${entryIds}`);

    // Group lines by entry
    const linesByEntry = new Map<string, typeof lines>();

    for (const line of lines) {
      const existing = linesByEntry.get(line.journalEntryId) ?? [];
      existing.push(line);
      linesByEntry.set(line.journalEntryId, existing);
    }

    const result = entries.map((entry) => ({
      ...entry,
      lines: linesByEntry.get(entry.id) ?? [],
    }));

    return { entries: result };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const { bookId, date, memo, source, lines } = body;

      if (await isPeriodLocked(bookId, date)) {
        set.status = 409;
        return { error: "Cannot create entry in a closed period" };
      }

      const entry = await dbPool.transaction(async (tx) => {
        const [created] = await tx
          .insert(journalEntryTable)
          .values({
            bookId,
            date,
            memo: memo ?? null,
            source: (source ?? "manual") as InsertJournalEntry["source"],
          })
          .returning();

        const lineRows = lines.map((line) => ({
          journalEntryId: created.id,
          accountId: line.accountId,
          debit: line.debit ?? "0",
          credit: line.credit ?? "0",
          memo: line.memo ?? null,
        }));

        const insertedLines = await tx
          .insert(journalLineTable)
          .values(lineRows)
          .returning();

        return { ...created, lines: insertedLines };
      });

      emitAudit({
        type: "myfi.journal_entry.created",
        organizationId: bookId,
        actor: { id: "unknown" },
        resource: {
          type: "journal_entry",
          id: entry.id,
          name: memo ?? undefined,
        },
        data: {
          bookId,
          date,
          source: source ?? "manual",
          lineCount: lines.length,
        },
      });

      set.status = 201;

      return { entry };
    },
    {
      body: t.Object({
        bookId: t.String(),
        date: t.String(),
        memo: t.Optional(t.String()),
        source: t.Optional(t.String()),
        lines: t.Array(
          t.Object({
            accountId: t.String(),
            debit: t.Optional(t.String()),
            credit: t.Optional(t.String()),
            memo: t.Optional(t.String()),
          }),
        ),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(eq(journalEntryTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Journal entry not found" };
      }

      const [full] = await dbPool
        .select({
          bookId: journalEntryTable.bookId,
          date: journalEntryTable.date,
          memo: journalEntryTable.memo,
        })
        .from(journalEntryTable)
        .where(eq(journalEntryTable.id, id));

      if (full && (await isPeriodLocked(full.bookId, full.date))) {
        set.status = 409;
        return { error: "Cannot delete entry in a closed period" };
      }

      // Lines cascade-delete via FK constraint
      await dbPool
        .delete(journalEntryTable)
        .where(eq(journalEntryTable.id, id));

      if (full) {
        emitAudit({
          type: "myfi.journal_entry.deleted",
          organizationId: full.bookId,
          actor: { id: "unknown" },
          resource: { type: "journal_entry", id, name: full.memo ?? undefined },
          data: { bookId: full.bookId },
        });
      }

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default journalRoutes;
