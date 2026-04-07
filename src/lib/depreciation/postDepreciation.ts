import { and, eq, isNull } from "drizzle-orm";

import { SYSTEM_ACTOR, emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  fixedAssetTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import { calculateMonthlyDepreciation } from "./calculate";

import type { InferInsertModel } from "drizzle-orm";

/**
 * Post depreciation journal entries for all active fixed assets in a book
 * for a given year/month. Idempotent (skips assets that already have a
 * depreciation entry for the target period).
 */
const postDepreciation = async (
  bookId: string,
  year: number,
  month: number,
) => {
  const monthPadded = String(month).padStart(2, "0");

  // Fetch all active (non-disposed) fixed assets for this book
  const assets = await dbPool
    .select()
    .from(fixedAssetTable)
    .where(
      and(
        eq(fixedAssetTable.bookId, bookId),
        isNull(fixedAssetTable.disposedAt),
      ),
    );

  let postedCount = 0;
  let skippedCount = 0;

  for (const asset of assets) {
    const amount = calculateMonthlyDepreciation({
      acquisitionCost: Number(asset.acquisitionCost),
      salvageValue: Number(asset.salvageValue),
      usefulLifeMonths: asset.usefulLifeMonths,
      depreciationMethod: asset.depreciationMethod,
      macrsClass: asset.macrsClass,
      acquisitionDate: asset.acquisitionDate,
      targetYear: year,
      targetMonth: month,
    });

    if (amount <= 0) {
      skippedCount++;
      continue;
    }

    const sourceReferenceId = `${asset.id}:${year}-${monthPadded}`;

    // Idempotency check
    const [existing] = await dbPool
      .select({ id: journalEntryTable.id })
      .from(journalEntryTable)
      .where(
        and(
          eq(journalEntryTable.source, "depreciation"),
          eq(journalEntryTable.sourceReferenceId, sourceReferenceId),
        ),
      );

    if (existing) {
      skippedCount++;
      continue;
    }

    const entryDate = `${year}-${monthPadded}-01T00:00:00.000000+00`;

    await dbPool.transaction(async (tx) => {
      const [entry] = await tx
        .insert(journalEntryTable)
        .values({
          bookId,
          date: entryDate,
          memo: `Depreciation: ${asset.name}`,
          source: "depreciation",
          sourceReferenceId,
          isReviewed: true,
        } satisfies InferInsertModel<typeof journalEntryTable>)
        .returning();

      const amountStr = amount.toFixed(4);

      await tx.insert(journalLineTable).values([
        {
          journalEntryId: entry.id,
          accountId: asset.depreciationExpenseAccountId,
          debit: amountStr,
          credit: "0",
        } satisfies InferInsertModel<typeof journalLineTable>,
        {
          journalEntryId: entry.id,
          accountId: asset.accumulatedDepreciationAccountId,
          debit: "0",
          credit: amountStr,
        } satisfies InferInsertModel<typeof journalLineTable>,
      ]);

      await tx.insert(reconciliationQueueTable).values({
        bookId,
        journalEntryId: entry.id,
        status: "approved",
        categorizationSource: "rule",
        confidence: "1.00",
        priority: 0,
        periodYear: year,
        periodMonth: month,
      } satisfies InferInsertModel<typeof reconciliationQueueTable>);
    });

    emitAudit({
      type: "myfi.depreciation.posted",
      organizationId: bookId,
      actor: SYSTEM_ACTOR,
      resource: {
        type: "fixed_asset",
        id: asset.id,
        name: asset.name,
      },
      data: { year, month, amount },
    });

    postedCount++;
  }

  return { postedCount, skippedCount };
};

export default postDepreciation;
