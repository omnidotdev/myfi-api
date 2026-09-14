import { Elysia, t } from "elysia";

import { importOpeningBalances } from "./importOpeningBalances";
import { parseTrialBalanceCsv } from "./parseTrialBalanceCsv";
import { resolveTrialBalanceAccounts } from "./resolveTrialBalanceAccounts";

import type { OpeningBalanceLine } from "./importOpeningBalances";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_SCALE = 10000;

/** Whether a set of debit/credit amounts balances in integer ten-thousandths */
const isBalanced = (rows: { debit: number; credit: number }[]): boolean => {
  let debitUnits = 0;
  let creditUnits = 0;
  for (const row of rows) {
    debitUnits += Math.round(row.debit * MONEY_SCALE);
    creditUnits += Math.round(row.credit * MONEY_SCALE);
  }
  return debitUnits === creditUnits;
};

/**
 * File-based QuickBooks migration routes.
 *
 * A customer exports their QuickBooks "Trial Balance" as CSV and uploads it;
 * MyFi imports it as a single balanced opening-balance entry dated the cutover.
 * No QuickBooks API is involved. Book access is enforced by the global
 * bookAccessMiddleware (bookId is read from the multipart body).
 */
const migrationRoutes = new Elysia({ prefix: "/api/migration" })
  // Preview: parse + auto-match, no writes. Drives the UI's review step
  .post(
    "/opening-balances/preview",
    async ({ body, set }) => {
      const { bookId, file } = body;

      let parsed: ReturnType<typeof parseTrialBalanceCsv>;
      try {
        parsed = parseTrialBalanceCsv(await file.text());
      } catch (err) {
        set.status = 400;
        return {
          error:
            err instanceof Error
              ? err.message
              : "Could not parse the Trial Balance",
        };
      }

      const { mapped, unmatched } = await resolveTrialBalanceAccounts({
        bookId,
        parsed,
      });

      return {
        asOf: parsed.asOf ?? null,
        accountCount: parsed.accounts.length,
        balances: isBalanced(parsed.accounts),
        matched: mapped.map((m) => ({
          name: m.name,
          debit: m.debit,
          credit: m.credit,
        })),
        unmatched,
      };
    },
    {
      body: t.Object({ bookId: t.String(), file: t.File() }),
    },
  )
  // Commit: import the opening balances (idempotent replace). Requires every
  // account to be mapped, either auto-matched or via `mappings` (name->accountId)
  .post(
    "/opening-balances",
    async ({ body, set }) => {
      const { bookId, file, asOf, mappings } = body;

      if (!ISO_DATE.test(asOf)) {
        set.status = 400;
        return { error: "asOf must be a YYYY-MM-DD date" };
      }

      let parsed: ReturnType<typeof parseTrialBalanceCsv>;
      try {
        parsed = parseTrialBalanceCsv(await file.text());
      } catch (err) {
        set.status = 400;
        return {
          error:
            err instanceof Error
              ? err.message
              : "Could not parse the Trial Balance",
        };
      }

      const { mapped, unmatched } = await resolveTrialBalanceAccounts({
        bookId,
        parsed,
      });

      // Manual resolutions for accounts auto-match could not place, keyed by
      // account name -> MyFi account id. Elysia may deliver a JSON-looking
      // multipart field already parsed into an object, so accept both a string
      // and an object
      let manual: Record<string, string> = {};
      if (typeof mappings === "string") {
        try {
          manual = JSON.parse(mappings);
        } catch {
          set.status = 400;
          return { error: "Invalid account mappings" };
        }
      } else if (mappings) {
        manual = mappings;
      }

      const lines: OpeningBalanceLine[] = [...mapped];
      const stillUnmatched: typeof unmatched = [];
      for (const account of unmatched) {
        const accountId = manual[account.name];
        if (accountId) {
          lines.push({
            accountId,
            debit: account.debit,
            credit: account.credit,
            name: account.name,
          });
        } else {
          stillUnmatched.push(account);
        }
      }

      if (stillUnmatched.length > 0) {
        set.status = 400;
        return {
          error: "Some accounts are not mapped to a MyFi account",
          unmatched: stillUnmatched,
        };
      }

      try {
        const result = await importOpeningBalances({
          bookId,
          asOf: `${asOf}T00:00:00.000Z`,
          lines,
        });
        return { imported: result.lineCount, replaced: result.replaced, asOf };
      } catch (err) {
        // e.g. the trial balance does not balance
        set.status = 400;
        return {
          error: err instanceof Error ? err.message : "Import failed",
        };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        file: t.File(),
        asOf: t.String(),
        mappings: t.Optional(
          t.Union([t.String(), t.Record(t.String(), t.String())]),
        ),
      }),
    },
  );

export default migrationRoutes;
