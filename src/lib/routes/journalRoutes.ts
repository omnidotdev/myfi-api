import { desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";

import type { InsertJournalEntry } from "lib/db/schema";

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

      // Lines cascade-delete via FK constraint
      await dbPool
        .delete(journalEntryTable)
        .where(eq(journalEntryTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default journalRoutes;
