import { and, eq, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import generateBalanceSheet from "lib/reports/balanceSheet";

type Severity = "error" | "warning" | "info";

type Finding = {
  code: string;
  severity: Severity;
  title: string;
  detail: string;
  count?: number;
};

/** An entry summarized for anomaly checks (amount = total debits of the entry) */
export type ReviewEntry = {
  id: string;
  date: string;
  memo: string | null;
  source: string;
  amount: number;
};

type AccountBalance = {
  accountName: string;
  balance: number;
};

// Suspense/holding accounts should always net to zero at close; a nonzero
// balance means something was parked there and never resolved
const SUSPENSE_PATTERN =
  /suspense|clearing|uncategoriz|ask.{0,3}(my )?accountant/i;
const DUP_MIN_GROUP = 2;

// =============================================================================
// Pure checks (unit-tested without a database)
// =============================================================================

/**
 * Flag groups of entries that share the same date, absolute amount, and memo,
 * a common double-entry mistake. Blank-memo entries are skipped: legitimately
 * identical postings (e.g. equal recurring transfers) would otherwise all trip
 */
export const checkDuplicates = (entries: ReviewEntry[]): Finding[] => {
  const groups = new Map<string, ReviewEntry[]>();

  for (const e of entries) {
    const memo = (e.memo ?? "").trim().toLowerCase();
    if (!memo) continue;
    const key = `${e.date}|${Math.abs(e.amount).toFixed(2)}|${memo}`;
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }

  const dupGroups = [...groups.values()].filter(
    (g) => g.length >= DUP_MIN_GROUP,
  );
  if (dupGroups.length === 0) return [];

  const total = dupGroups.reduce((sum, g) => sum + g.length, 0);
  return [
    {
      code: "possible_duplicates",
      severity: "warning",
      title: "Possible duplicate entries",
      detail: `${dupGroups.length} set(s) of entries share the same date, amount, and memo (${total} entries). Confirm none were posted twice.`,
      count: dupGroups.length,
    },
  ];
};

/** Manual entries with no memo are a data-quality gap a reviewer would fix */
export const checkMissingMemos = (entries: ReviewEntry[]): Finding[] => {
  const missing = entries.filter(
    (e) => e.source === "manual" && !(e.memo ?? "").trim(),
  );
  if (missing.length === 0) return [];
  return [
    {
      code: "missing_memos",
      severity: "info",
      title: "Manual entries without a memo",
      detail: `${missing.length} manual entr${missing.length === 1 ? "y has" : "ies have"} no memo. Add context so the books stay auditable.`,
      count: missing.length,
    },
  ];
};

/** Suspense/clearing/uncategorized accounts must be zero at close */
export const checkSuspenseBalances = (
  balances: AccountBalance[],
): Finding[] => {
  const open = balances.filter(
    (b) => SUSPENSE_PATTERN.test(b.accountName) && Math.abs(b.balance) > 0.005,
  );
  return open.map((b) => ({
    code: "open_suspense_balance",
    severity: "warning",
    title: `"${b.accountName}" has a balance`,
    detail: `A holding account should net to zero at close but carries ${b.balance.toFixed(2)}. Reclassify it to a real account.`,
  }));
};

/** Debits must equal credits for the period */
export const checkTrialBalance = (
  totalDebits: number,
  totalCredits: number,
): Finding[] => {
  if (Math.abs(totalDebits - totalCredits) <= 0.005) return [];
  return [
    {
      code: "trial_balance_off",
      severity: "error",
      title: "Trial balance does not balance",
      detail: `Debits (${totalDebits.toFixed(2)}) do not equal credits (${totalCredits.toFixed(2)}) for the period.`,
    },
  ];
};

/** Items still awaiting categorization/review block a clean close */
export const checkPendingReview = (pendingCount: number): Finding[] => {
  if (pendingCount <= 0) return [];
  return [
    {
      code: "pending_review",
      severity: "error",
      title: "Transactions awaiting review",
      detail: `${pendingCount} transaction(s) are uncategorized or pending review. Clear the review queue before closing.`,
      count: pendingCount,
    },
  ];
};

// =============================================================================
// Orchestrator
// =============================================================================

type CloseReview = {
  bookId: string;
  year: number;
  month: number;
  readyToClose: boolean;
  errorCount: number;
  warningCount: number;
  findings: Finding[];
  generatedAt: string;
};

const periodBounds = (year: number, month: number) => {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endExclusive =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  // As-of date for point-in-time balances: the last day of the period
  const end = new Date(Date.UTC(year, month, 0));
  const asOfDate = end.toISOString().slice(0, 10);
  return { startDate, endExclusive, asOfDate };
};

/**
 * Run the automated close-review battery for a book/period, the checks a
 * bookkeeper works through before closing. Returns findings by severity and
 * whether the period is clean enough to close (no errors)
 */
export const runCloseReview = async (
  bookId: string,
  year: number,
  month: number,
): Promise<CloseReview> => {
  const { startDate, endExclusive, asOfDate } = periodBounds(year, month);

  // Period entries with their total amount (sum of debits)
  const entryRows = await dbPool
    .select({
      id: journalEntryTable.id,
      date: journalEntryTable.date,
      memo: journalEntryTable.memo,
      source: journalEntryTable.source,
      amount: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
    })
    .from(journalEntryTable)
    .innerJoin(
      journalLineTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        sql`${journalEntryTable.date} >= ${startDate}`,
        sql`${journalEntryTable.date} < ${endExclusive}`,
      ),
    )
    .groupBy(
      journalEntryTable.id,
      journalEntryTable.date,
      journalEntryTable.memo,
      journalEntryTable.source,
    );

  const entries: ReviewEntry[] = entryRows.map((r) => ({
    id: r.id,
    date: r.date,
    memo: r.memo,
    source: r.source,
    amount: Number.parseFloat(r.amount),
  }));

  const [tb] = await dbPool
    .select({
      totalDebits: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      totalCredits: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalEntryTable.bookId, bookId),
        sql`${journalEntryTable.date} >= ${startDate}`,
        sql`${journalEntryTable.date} < ${endExclusive}`,
      ),
    );

  const pending = await dbPool
    .select({ id: reconciliationQueueTable.id })
    .from(reconciliationQueueTable)
    .where(
      and(
        eq(reconciliationQueueTable.bookId, bookId),
        eq(reconciliationQueueTable.status, "pending_review"),
        eq(reconciliationQueueTable.periodYear, year),
        eq(reconciliationQueueTable.periodMonth, month),
      ),
    );

  const bs = await generateBalanceSheet({ bookId, asOfDate });
  const balances: AccountBalance[] = [
    ...bs.assets,
    ...bs.liabilities,
    ...bs.equity,
  ].map((a) => ({
    accountName: a.accountName,
    balance: Number.parseFloat(a.balance),
  }));

  const findings: Finding[] = [
    ...checkPendingReview(pending.length),
    ...checkTrialBalance(
      Number(tb?.totalDebits ?? 0),
      Number(tb?.totalCredits ?? 0),
    ),
    ...checkSuspenseBalances(balances),
    ...checkDuplicates(entries),
    ...checkMissingMemos(entries),
  ];

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;

  return {
    bookId,
    year,
    month,
    readyToClose: errorCount === 0,
    errorCount,
    warningCount,
    findings,
    generatedAt: new Date().toISOString(),
  };
};
