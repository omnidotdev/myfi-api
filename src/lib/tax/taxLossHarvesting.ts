import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable, cryptoLotTable } from "lib/db/schema";

type HarvestableAsset = {
  cryptoAssetId: string;
  symbol: string;
  name: string;
  totalQuantity: string;
  costBasis: string;
  estimatedCurrentValue: string;
  unrealizedLoss: string;
  potentialTaxSavings: string;
};

type TaxLossHarvestingReport = {
  bookId: string;
  assets: HarvestableAsset[];
  totalUnrealizedLoss: string;
  totalPotentialSavings: string;
  estimatedTaxRate: number;
  generatedAt: string;
};

/**
 * Estimated combined marginal tax rate used to approximate tax savings.
 * Combines a rough federal bracket (22%) with SE tax deduction benefit
 */
const ESTIMATED_TAX_RATE = 0.22;

/**
 * Identify crypto positions with unrealized losses for tax-loss harvesting.
 * Compares cost basis of undisposed lots against current asset balance value.
 * Because real-time price feeds may not be integrated, the current value is
 * estimated from the most recent disposed lot's proceeds-per-unit or falls
 * back to cost basis (meaning zero unrealized loss)
 * @param params - Book ID
 * @returns Assets with unrealized losses and potential tax savings
 */
const generateTaxLossHarvesting = async (params: {
  bookId: string;
}): Promise<TaxLossHarvestingReport> => {
  const { bookId } = params;

  // Get undisposed lots grouped by crypto asset, with the most recent
  // disposal price as a proxy for current FMV
  const positions = await dbPool
    .select({
      cryptoAssetId: cryptoAssetTable.id,
      symbol: cryptoAssetTable.symbol,
      name: cryptoAssetTable.name,
      totalQuantity:
        sql<string>`coalesce(sum(${cryptoLotTable.remainingQuantity}), 0)`,
      totalCostBasis:
        sql<string>`coalesce(sum(${cryptoLotTable.remainingQuantity} * ${cryptoLotTable.costPerUnit}), 0)`,
    })
    .from(cryptoLotTable)
    .innerJoin(
      cryptoAssetTable,
      eq(cryptoLotTable.cryptoAssetId, cryptoAssetTable.id),
    )
    .where(
      and(
        eq(cryptoAssetTable.bookId, bookId),
        isNull(cryptoLotTable.disposedAt),
        gt(cryptoLotTable.remainingQuantity, "0"),
      ),
    )
    .groupBy(
      cryptoAssetTable.id,
      cryptoAssetTable.symbol,
      cryptoAssetTable.name,
    );

  // For each asset, get the latest disposal price as a FMV proxy
  const assets: HarvestableAsset[] = [];
  let totalUnrealizedLoss = 0;

  for (const pos of positions) {
    const qty = Number.parseFloat(pos.totalQuantity);
    if (qty <= 0) continue;

    const costBasis = Number.parseFloat(pos.totalCostBasis);

    // Query most recent disposal price for this asset
    const [latestDisposal] = await dbPool
      .select({
        proceedsPerUnit: cryptoLotTable.proceedsPerUnit,
      })
      .from(cryptoLotTable)
      .innerJoin(
        cryptoAssetTable,
        eq(cryptoLotTable.cryptoAssetId, cryptoAssetTable.id),
      )
      .where(
        and(
          eq(cryptoAssetTable.id, pos.cryptoAssetId),
          sql`${cryptoLotTable.disposedAt} is not null`,
          sql`${cryptoLotTable.proceedsPerUnit} is not null`,
        ),
      )
      .orderBy(sql`${cryptoLotTable.disposedAt} desc`)
      .limit(1);

    // If no disposal exists, we cannot estimate FMV - skip
    if (!latestDisposal?.proceedsPerUnit) continue;

    const currentPricePerUnit = Number.parseFloat(
      latestDisposal.proceedsPerUnit,
    );
    const estimatedValue = qty * currentPricePerUnit;
    const unrealizedLoss = estimatedValue - costBasis;

    // Only include assets with unrealized losses (negative = loss)
    if (unrealizedLoss >= 0) continue;

    const loss = Math.abs(unrealizedLoss);
    const potentialSavings = loss * ESTIMATED_TAX_RATE;
    totalUnrealizedLoss += loss;

    assets.push({
      cryptoAssetId: pos.cryptoAssetId,
      symbol: pos.symbol,
      name: pos.name,
      totalQuantity: qty.toFixed(8),
      costBasis: costBasis.toFixed(2),
      estimatedCurrentValue: estimatedValue.toFixed(2),
      unrealizedLoss: (-loss).toFixed(2),
      potentialTaxSavings: potentialSavings.toFixed(2),
    });
  }

  return {
    bookId,
    assets,
    totalUnrealizedLoss: (-totalUnrealizedLoss).toFixed(2),
    totalPotentialSavings: (totalUnrealizedLoss * ESTIMATED_TAX_RATE).toFixed(2),
    estimatedTaxRate: ESTIMATED_TAX_RATE,
    generatedAt: new Date().toISOString(),
  };
};

export default generateTaxLossHarvesting;
