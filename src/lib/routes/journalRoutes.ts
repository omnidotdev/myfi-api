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
import { validateJournalLines } from "lib/journal/validateEntry";

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

      try {
        validateJournalLines(lines);
      } catch (err) {
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : "Invalid journal entry",
        };
      }

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
  .post(
    "/batch",
    async ({ body, set }) => {
      const { entries } = body;

      if (entries.length > 100) {
        set.status = 400;
        return { error: "Maximum 100 entries per batch" };
      }

      if (entries.length === 0) {
        set.status = 400;
        return { error: "At least one entry required" };
      }

      // Validate all entries before creating any, using the same server-side
      // invariants as the single-entry create so a batch cannot slip past them
      for (const entry of entries) {
        if (await isPeriodLocked(entry.bookId, entry.date)) {
          set.status = 409;
          return { error: "Cannot create entry in a closed period" };
        }

        try {
          validateJournalLines(entry.lines);
        } catch (err) {
          set.status = 400;
          return {
            error: err instanceof Error ? err.message : "Invalid journal entry",
          };
        }
      }

      // Create all entries in a single transaction
      const created = await dbPool.transaction(async (tx) => {
        const results = [];

        for (const entry of entries) {
          const [journalEntry] = await tx
            .insert(journalEntryTable)
            .values({
              bookId: entry.bookId,
              date: entry.date,
              memo: entry.memo ?? null,
              source: "manual",
              isReviewed: true,
            })
            .returning();

          const lines = await tx
            .insert(journalLineTable)
            .values(
              entry.lines.map((line) => ({
                journalEntryId: journalEntry.id,
                accountId: line.accountId,
                debit: line.debit ?? "0.0000",
                credit: line.credit ?? "0.0000",
                memo: line.memo ?? null,
              })),
            )
            .returning();

          results.push({ ...journalEntry, lines });

          emitAudit({
            type: "myfi.journal_entry.created",
            organizationId: entry.bookId,
            resource: {
              type: "journal_entry",
              id: journalEntry.id,
            },
            data: { source: "batch", lineCount: lines.length },
          });
        }

        return results;
      });

      set.status = 201;
      return { entries: created };
    },
    {
      body: t.Object({
        entries: t.Array(
          t.Object({
            bookId: t.String(),
            date: t.String(),
            memo: t.Optional(t.String()),
            vendorId: t.Optional(t.String()),
            lines: t.Array(
              t.Object({
                accountId: t.String(),
                debit: t.Optional(t.String()),
                credit: t.Optional(t.String()),
                memo: t.Optional(t.String()),
              }),
            ),
          }),
        ),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select()
        .from(journalEntryTable)
        .where(eq(journalEntryTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Journal entry not found" };
      }

      if (body.lines) {
        try {
          validateJournalLines(body.lines);
        } catch (err) {
          set.status = 400;
          return {
            error: err instanceof Error ? err.message : "Invalid journal entry",
          };
        }
      }

      const effectiveDate = body.date ?? existing.date;

      if (await isPeriodLocked(existing.bookId, effectiveDate)) {
        set.status = 409;
        return { error: "Cannot update entry in a closed period" };
      }

      const entry = await dbPool.transaction(async (tx) => {
        // Build update payload from provided fields
        const updates: Partial<InsertJournalEntry> = {};
        if (body.date !== undefined) updates.date = body.date;
        if (body.memo !== undefined) updates.memo = body.memo ?? null;
        if (body.vendorId !== undefined) updates.vendorId = body.vendorId;

        let updated = existing;

        if (Object.keys(updates).length > 0) {
          const [row] = await tx
            .update(journalEntryTable)
            .set(updates)
            .where(eq(journalEntryTable.id, id))
            .returning();

          updated = row;
        }

        let lines: unknown[] = [];

        if (body.lines) {
          // Delete existing lines, then insert new ones
          await tx
            .delete(journalLineTable)
            .where(eq(journalLineTable.journalEntryId, id));

          const lineRows = body.lines.map((line) => ({
            journalEntryId: id,
            accountId: line.accountId,
            debit: line.debit ?? "0",
            credit: line.credit ?? "0",
            memo: line.memo ?? null,
          }));

          lines = await tx
            .insert(journalLineTable)
            .values(lineRows)
            .returning();
        }

        return { ...updated, lines };
      });

      emitAudit({
        type: "myfi.journal_entry.updated",
        organizationId: existing.bookId,
        resource: {
          type: "journal_entry",
          id,
          name: entry.memo ?? undefined,
        },
        data: {
          bookId: existing.bookId,
          updatedFields: Object.keys(body).filter(
            (k) => body[k as keyof typeof body] !== undefined,
          ),
        },
      });

      return { entry };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        date: t.Optional(t.String()),
        memo: t.Optional(t.String()),
        vendorId: t.Optional(t.Nullable(t.String())),
        lines: t.Optional(
          t.Array(
            t.Object({
              accountId: t.String(),
              debit: t.Optional(t.String()),
              credit: t.Optional(t.String()),
              memo: t.Optional(t.String()),
            }),
          ),
        ),
      }),
    },
  )
  // Post a reversing entry: a new entry with each line's debit and credit
  // swapped, dated today (or a given date). The non-destructive way to correct
  // a posted entry, which CPAs use instead of editing/deleting history
  .post(
    "/:id/reverse",
    async ({ params, body, set }) => {
      const { id } = params;

      const [original] = await dbPool
        .select()
        .from(journalEntryTable)
        .where(eq(journalEntryTable.id, id));
      if (!original) {
        set.status = 404;
        return { error: "Journal entry not found" };
      }

      const reversalDate = body.date ?? new Date().toISOString().slice(0, 10);
      if (await isPeriodLocked(original.bookId, reversalDate)) {
        set.status = 409;
        return { error: "Cannot post a reversal in a closed period" };
      }

      const originalLines = await dbPool
        .select()
        .from(journalLineTable)
        .where(eq(journalLineTable.journalEntryId, id));
      if (originalLines.length === 0) {
        set.status = 400;
        return { error: "Entry has no lines to reverse" };
      }

      const entry = await dbPool.transaction(async (tx) => {
        const [created] = await tx
          .insert(journalEntryTable)
          .values({
            bookId: original.bookId,
            date: reversalDate,
            memo: `Reversal of ${original.memo ?? id}`,
            source: "reversal" as InsertJournalEntry["source"],
            sourceReferenceId: id,
          })
          .returning();

        const lineRows = originalLines.map((line) => ({
          journalEntryId: created.id,
          accountId: line.accountId,
          // swap debit and credit to reverse the original's effect
          debit: line.credit,
          credit: line.debit,
          memo: line.memo,
        }));
        const insertedLines = await tx
          .insert(journalLineTable)
          .values(lineRows)
          .returning();

        return { ...created, lines: insertedLines };
      });

      emitAudit({
        type: "myfi.journal_entry.reversed",
        organizationId: original.bookId,
        resource: { type: "journal_entry", id: entry.id },
        data: { bookId: original.bookId, reversalOf: id, date: reversalDate },
      });

      set.status = 201;
      return { entry };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ date: t.Optional(t.String()) }),
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
