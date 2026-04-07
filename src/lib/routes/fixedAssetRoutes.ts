import { and, eq, like, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  fixedAssetTable,
  journalEntryTable,
  journalLineTable,
  reconciliationQueueTable,
} from "lib/db/schema";
import {
  calculateMonthlyDepreciation,
  postDepreciation,
} from "lib/depreciation";

import type { InferInsertModel } from "drizzle-orm";

/**
 * Sum total depreciation posted for a given asset by querying journal lines
 * linked to depreciation entries whose sourceReferenceId starts with the asset ID.
 */
const getTotalDepreciated = async (assetId: string): Promise<number> => {
  const [result] = await dbPool
    .select({
      total: sql<string>`coalesce(sum(${journalLineTable.credit}), 0)`,
    })
    .from(journalLineTable)
    .innerJoin(
      journalEntryTable,
      eq(journalLineTable.journalEntryId, journalEntryTable.id),
    )
    .where(
      and(
        eq(journalEntryTable.source, "depreciation"),
        like(journalEntryTable.sourceReferenceId, `${assetId}:%`),
      ),
    );

  return Number(result?.total ?? 0);
};

// Fixed asset CRUD and disposal routes
const fixedAssetRoutes = new Elysia({ prefix: "/api/fixed-assets" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const assets = await dbPool
      .select()
      .from(fixedAssetTable)
      .where(eq(fixedAssetTable.bookId, bookId));

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const enriched = await Promise.all(
      assets.map(async (asset) => {
        const totalDepreciated = await getTotalDepreciated(asset.id);
        const bookValue = Number(asset.acquisitionCost) - totalDepreciated;

        const monthlyDepreciation = calculateMonthlyDepreciation({
          acquisitionCost: Number(asset.acquisitionCost),
          salvageValue: Number(asset.salvageValue),
          usefulLifeMonths: asset.usefulLifeMonths,
          depreciationMethod: asset.depreciationMethod,
          macrsClass: asset.macrsClass,
          acquisitionDate: asset.acquisitionDate,
          targetYear: currentYear,
          targetMonth: currentMonth,
        });

        return {
          ...asset,
          totalDepreciated,
          bookValue,
          monthlyDepreciation,
        };
      }),
    );

    return { assets: enriched };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [asset] = await dbPool
        .insert(fixedAssetTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          description: body.description ?? null,
          assetAccountId: body.assetAccountId,
          depreciationExpenseAccountId: body.depreciationExpenseAccountId,
          accumulatedDepreciationAccountId:
            body.accumulatedDepreciationAccountId,
          acquisitionDate: body.acquisitionDate,
          acquisitionCost: body.acquisitionCost,
          salvageValue: body.salvageValue ?? "0.0000",
          usefulLifeMonths: body.usefulLifeMonths,
          depreciationMethod: body.depreciationMethod,
          macrsClass: body.macrsClass ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.asset.created",
        organizationId: body.bookId,
        actor: { id: "unknown" },
        resource: { type: "fixed_asset", id: asset.id, name: asset.name },
        data: { bookId: body.bookId },
      });

      return { asset };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        assetAccountId: t.String(),
        depreciationExpenseAccountId: t.String(),
        accumulatedDepreciationAccountId: t.String(),
        acquisitionDate: t.String(),
        acquisitionCost: t.String(),
        salvageValue: t.Optional(t.String()),
        usefulLifeMonths: t.Number(),
        depreciationMethod: t.String(),
        macrsClass: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [asset] = await dbPool
        .select()
        .from(fixedAssetTable)
        .where(eq(fixedAssetTable.id, id));

      if (!asset) {
        set.status = 404;
        return { error: "Asset not found" };
      }

      // Check for existing depreciation entries
      const [depEntry] = await dbPool
        .select({ id: journalEntryTable.id })
        .from(journalEntryTable)
        .where(
          and(
            eq(journalEntryTable.source, "depreciation"),
            like(journalEntryTable.sourceReferenceId, `${id}:%`),
          ),
        )
        .limit(1);

      if (depEntry) {
        set.status = 409;
        return { error: "Cannot delete asset with depreciation entries" };
      }

      await dbPool.delete(fixedAssetTable).where(eq(fixedAssetTable.id, id));

      emitAudit({
        type: "myfi.asset.deleted",
        organizationId: asset.bookId,
        actor: { id: "unknown" },
        resource: { type: "fixed_asset", id: asset.id, name: asset.name },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/:id/dispose",
    async ({ params, body, set }) => {
      const { id } = params;

      const [asset] = await dbPool
        .select()
        .from(fixedAssetTable)
        .where(eq(fixedAssetTable.id, id));

      if (!asset) {
        set.status = 404;
        return { error: "Asset not found" };
      }

      if (asset.disposedAt) {
        set.status = 409;
        return { error: "Asset is already disposed" };
      }

      const totalDepreciated = await getTotalDepreciated(asset.id);
      const acquisitionCost = Number(asset.acquisitionCost);
      const proceeds = Number(body.disposalProceeds);
      const bookValue = acquisitionCost - totalDepreciated;
      const gainLoss = proceeds - bookValue;

      // Build journal lines for the disposal entry
      const disposalDate = `${body.disposedAt}T00:00:00.000000+00`;

      const { journalEntry } = await dbPool.transaction(async (tx) => {
        const [entry] = await tx
          .insert(journalEntryTable)
          .values({
            bookId: asset.bookId,
            date: disposalDate,
            memo: `Disposal: ${asset.name}`,
            source: "disposal",
            sourceReferenceId: `${asset.id}:disposal`,
            isReviewed: true,
          } satisfies InferInsertModel<typeof journalEntryTable>)
          .returning();

        const lines: InferInsertModel<typeof journalLineTable>[] = [
          // Debit cash/proceeds account
          {
            journalEntryId: entry.id,
            accountId: body.proceedsAccountId,
            debit: proceeds.toFixed(4),
            credit: "0",
          },
          // Debit accumulated depreciation (remove contra-asset)
          {
            journalEntryId: entry.id,
            accountId: asset.accumulatedDepreciationAccountId,
            debit: totalDepreciated.toFixed(4),
            credit: "0",
          },
          // Credit fixed asset account (remove asset at cost)
          {
            journalEntryId: entry.id,
            accountId: asset.assetAccountId,
            debit: "0",
            credit: acquisitionCost.toFixed(4),
          },
        ];

        // Gain or loss line to keep the entry balanced
        if (Math.abs(gainLoss) > 0.005) {
          if (gainLoss > 0) {
            // Gain: credit gain/loss account
            lines.push({
              journalEntryId: entry.id,
              accountId: body.gainLossAccountId,
              debit: "0",
              credit: gainLoss.toFixed(4),
            });
          } else {
            // Loss: debit gain/loss account
            lines.push({
              journalEntryId: entry.id,
              accountId: body.gainLossAccountId,
              debit: Math.abs(gainLoss).toFixed(4),
              credit: "0",
            });
          }
        }

        await tx.insert(journalLineTable).values(lines);

        await tx.insert(reconciliationQueueTable).values({
          bookId: asset.bookId,
          journalEntryId: entry.id,
          status: "approved",
          categorizationSource: "rule",
          confidence: "1.00",
          priority: 0,
          periodYear: new Date(body.disposedAt).getFullYear(),
          periodMonth: new Date(body.disposedAt).getMonth() + 1,
        } satisfies InferInsertModel<typeof reconciliationQueueTable>);

        return { journalEntry: entry };
      });

      // Update the asset record
      const [updatedAsset] = await dbPool
        .update(fixedAssetTable)
        .set({
          disposedAt: body.disposedAt,
          disposalProceeds: body.disposalProceeds,
        })
        .where(eq(fixedAssetTable.id, id))
        .returning();

      emitAudit({
        type: "myfi.asset.disposed",
        organizationId: asset.bookId,
        actor: { id: "unknown" },
        resource: { type: "fixed_asset", id: asset.id, name: asset.name },
        data: {
          disposedAt: body.disposedAt,
          proceeds,
          bookValue,
          gainLoss,
        },
      });

      return { asset: updatedAsset, journalEntry };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        disposedAt: t.String(),
        disposalProceeds: t.String(),
        proceedsAccountId: t.String(),
        gainLossAccountId: t.String(),
      }),
    },
  )
  .post(
    "/run-depreciation",
    async ({ body }) => {
      const result = await postDepreciation(body.bookId, body.year, body.month);
      return { result };
    },
    {
      body: t.Object({
        bookId: t.String(),
        year: t.Number(),
        month: t.Number(),
      }),
    },
  );

export default fixedAssetRoutes;
