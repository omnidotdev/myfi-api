import { and, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
} from "lib/db/schema";
import { buildDebtOpeningLines } from "lib/debts/buildDebtOpeningLines";

import type { InferInsertModel } from "drizzle-orm";

/** Marks the opening-balance entry that seeds a simple debt's balance */
const DEBT_OPENING_SOURCE = "debt_opening_balance";

/**
 * Simple debts: a liability you owe, tracked as a balance, without the
 * amortization machinery of a loan (no schedule, no funding account). This is
 * the market-aligned "what I owe" model. Creating a debt is one atomic step:
 * make the liability account and, if an amount is given, post a balanced opening
 * entry crediting the liability and debiting an equity (net worth) account
 */
const debtRoutes = new Elysia({ prefix: "/api/debts" })
  // List liabilities with their current balance (credit - debit)
  .get("/", async ({ query, set }) => {
    const { bookId } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const liabilities = await dbPool
      .select({
        id: accountTable.id,
        name: accountTable.name,
        subType: accountTable.subType,
      })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.bookId, bookId),
          eq(accountTable.type, "liability"),
          eq(accountTable.isPlaceholder, false),
        ),
      );

    const balances = await dbPool
      .select({
        accountId: journalLineTable.accountId,
        balance: sql<string>`coalesce(sum(${journalLineTable.credit}::numeric - ${journalLineTable.debit}::numeric), 0)`,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .where(eq(journalEntryTable.bookId, bookId))
      .groupBy(journalLineTable.accountId);

    const balanceByAccount = new Map(
      balances.map((b) => [b.accountId, Number(b.balance)]),
    );

    const debts = liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      subType: l.subType,
      balance: balanceByAccount.get(l.id) ?? 0,
    }));

    return { debts };
  })
  // Create a debt: liability account + optional balanced opening entry
  .post(
    "/",
    async ({ body, set }) => {
      const amount = Number.parseFloat(body.amount);
      if (Number.isNaN(amount) || amount < 0) {
        set.status = 400;
        return { error: "amount must be a non-negative number" };
      }

      // Offset the opening balance against an equity account (net worth),
      // preferring an owners-equity account, so the books stay balanced
      const equityAccounts = await dbPool
        .select({ id: accountTable.id, subType: accountTable.subType })
        .from(accountTable)
        .where(
          and(
            eq(accountTable.bookId, body.bookId),
            eq(accountTable.type, "equity"),
            eq(accountTable.isPlaceholder, false),
          ),
        );

      const offset =
        equityAccounts.find((a) => a.subType === "owners_equity") ??
        equityAccounts[0];

      if (amount > 0 && !offset) {
        set.status = 400;
        return {
          error: "No equity account to offset the opening balance against",
        };
      }

      const result = await dbPool.transaction(async (tx) => {
        const [account] = await tx
          .insert(accountTable)
          .values({
            bookId: body.bookId,
            name: body.name,
            type: "liability",
            subType: "loan",
            isPlaceholder: false,
          })
          .returning();

        if (!account) throw new Error("Failed to create the debt account");

        const lines =
          offset &&
          buildDebtOpeningLines({
            liabilityAccountId: account.id,
            offsetAccountId: offset.id,
            amount,
          });

        let entryId: string | null = null;
        if (lines) {
          const [entry] = await tx
            .insert(journalEntryTable)
            .values({
              bookId: body.bookId,
              date: new Date().toISOString(),
              memo: `Opening balance: ${body.name}`,
              source: DEBT_OPENING_SOURCE,
              sourceReferenceId: account.id,
            } satisfies InferInsertModel<typeof journalEntryTable>)
            .returning();

          if (!entry) throw new Error("Failed to write the opening entry");
          entryId = entry.id;

          for (const line of lines) {
            await tx.insert(journalLineTable).values({
              journalEntryId: entry.id,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
            } satisfies InferInsertModel<typeof journalLineTable>);
          }
        }

        return { account, entryId };
      });

      emitAudit({
        type: "myfi.account.created",
        organizationId: body.bookId,
        resource: {
          type: "account",
          id: result.account.id,
          name: result.account.name,
        },
        data: { bookId: body.bookId, accountType: "liability", debt: true },
      });

      set.status = 201;
      return { debt: result.account, entryId: result.entryId };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        amount: t.String(),
      }),
    },
  );

export default debtRoutes;
