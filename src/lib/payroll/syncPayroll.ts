import { and, eq } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  bookTable,
  journalEntryTable,
  journalLineTable,
  payrollConnectionTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";
import { validateJournalLines } from "lib/journal/validateEntry";
import { buildPayrollLines } from "./buildPayrollLines";
import { fetchPayrolls } from "./gustoClient";

import type { SelectPayrollConnection } from "lib/db/schema";

/**
 * Sync processed payrolls from Gusto into journal entries.
 * Idempotent: skips payrolls already imported via sourceReferenceId.
 * @param connection - Payroll connection record with encrypted tokens.
 */
const syncPayroll = async (
  connection: Pick<
    SelectPayrollConnection,
    | "id"
    | "bookId"
    | "accessToken"
    | "refreshToken"
    | "companyId"
    | "lastSyncedAt"
  >,
) => {
  if (!connection.accessToken || !connection.companyId) {
    throw new Error("Payroll connection missing access token or company ID");
  }

  const accessToken = decryptToken(connection.accessToken);

  // Default to 90 days ago when no previous sync
  const startDate = connection.lastSyncedAt
    ? connection.lastSyncedAt.split("T")[0]
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

  const payrolls = await fetchPayrolls(
    accessToken,
    connection.companyId,
    startDate,
  );

  // Look up book organizationId for audit events
  const [book] = await dbPool
    .select({ organizationId: bookTable.organizationId })
    .from(bookTable)
    .where(eq(bookTable.id, connection.bookId));

  if (!book) {
    throw new Error(`Book not found: ${connection.bookId}`);
  }

  // Pre-fetch account mappings for this book
  const mappings = await dbPool
    .select()
    .from(accountMappingTable)
    .where(eq(accountMappingTable.bookId, connection.bookId));

  const mappingsByEvent = new Map(mappings.map((m) => [m.eventType, m]));

  let syncedCount = 0;
  let skippedCount = 0;

  for (const payroll of payrolls) {
    const sourceRef = `gusto:${payroll.payroll_uuid}`;

    // Idempotency check
    const [existing] = await dbPool
      .select({ id: journalEntryTable.id })
      .from(journalEntryTable)
      .where(
        and(
          eq(journalEntryTable.bookId, connection.bookId),
          eq(journalEntryTable.source, "payroll_sync"),
          eq(journalEntryTable.sourceReferenceId, sourceRef),
        ),
      );

    if (existing) {
      skippedCount++;
      continue;
    }

    // Build balanced journal lines (employer taxes post as an expense/liability
    // pair, which the old per-side loop omitted, leaving every entry unbalanced)
    const lines = buildPayrollLines(payroll.totals, mappingsByEvent);

    // Guard: never post an unbalanced entry (e.g. an incomplete mapping); skip
    try {
      validateJournalLines(lines);
    } catch {
      skippedCount++;
      continue;
    }

    const checkDate = payroll.check_date;

    const [entry] = await dbPool
      .insert(journalEntryTable)
      .values({
        bookId: connection.bookId,
        date: checkDate,
        memo: `Payroll: ${checkDate}`,
        source: "payroll_sync",
        sourceReferenceId: sourceRef,
        isReviewed: true,
        isReconciled: false,
      })
      .returning();

    if (lines.length > 0) {
      await dbPool.insert(journalLineTable).values(
        lines.map((line) => ({
          journalEntryId: entry.id,
          ...line,
        })),
      );
    }

    const txnDate = new Date(checkDate);

    // Add to reconciliation queue as auto-approved
    await dbPool.insert(reconciliationQueueTable).values({
      bookId: connection.bookId,
      journalEntryId: entry.id,
      status: "approved",
      categorizationSource: "rule",
      confidence: "1.00",
      priority: 0,
      periodYear: txnDate.getFullYear(),
      periodMonth: txnDate.getMonth() + 1,
    });

    emitAudit({
      type: "myfi.payroll.synced",
      organizationId: book.organizationId,
      actor: SYSTEM_ACTOR,
      resource: {
        type: "payroll_connection",
        id: connection.id,
      },
      data: {
        payrollUuid: payroll.payroll_uuid,
        checkDate,
        linesCreated: lines.length,
      },
    });

    syncedCount++;
  }

  // Update connection lastSyncedAt
  await dbPool
    .update(payrollConnectionTable)
    .set({ lastSyncedAt: new Date().toISOString() })
    .where(eq(payrollConnectionTable.id, connection.id));

  return { syncedCount, skippedCount };
};

export default syncPayroll;
