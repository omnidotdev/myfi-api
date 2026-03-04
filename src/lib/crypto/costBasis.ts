import { and, asc, desc, eq, gt } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable, cryptoLotTable } from "lib/db/schema";

import type { SelectCryptoLot } from "lib/db/schema";

type CostBasisMethod = "fifo" | "lifo" | "hifo" | "acb";

type AcquireLotParams = {
  cryptoAssetId: string;
  quantity: string;
  costPerUnit: string;
  acquiredAt: string;
  journalEntryId?: string;
};

type DisposeLotParams = {
  cryptoAssetId: string;
  quantity: string;
  proceedsPerUnit: string;
  disposedAt: string;
  journalEntryId?: string;
};

type LotDisposal = {
  lotId: string;
  quantityDisposed: string;
  costBasis: string;
  proceeds: string;
  gainLoss: string;
};

type DisposalResult = {
  lotsUsed: LotDisposal[];
  totalCostBasis: string;
  totalProceeds: string;
  realizedGainLoss: string;
};

type UnrealizedLot = {
  lotId: string;
  acquiredAt: string;
  remainingQuantity: string;
  costPerUnit: string;
  costBasis: string;
  currentValue: string;
  unrealizedGainLoss: string;
};

type UnrealizedResult = {
  lots: UnrealizedLot[];
  totalCostBasis: string;
  totalCurrentValue: string;
  totalUnrealizedGainLoss: string;
};

/**
 * Record a new lot acquisition (buy, receive, airdrop).
 * @param params - Acquisition parameters
 * @returns Inserted lot record
 */
const acquireLot = async (params: AcquireLotParams) => {
  const { cryptoAssetId, quantity, costPerUnit, acquiredAt, journalEntryId } =
    params;

  const [lot] = await dbPool
    .insert(cryptoLotTable)
    .values({
      cryptoAssetId,
      quantity,
      costPerUnit,
      acquiredAt,
      remainingQuantity: quantity,
      journalEntryId: journalEntryId ?? null,
    })
    .returning();

  return lot;
};

/**
 * Select available lots for a crypto asset ordered by the given cost basis method.
 * @param cryptoAssetId - Asset to select lots for
 * @param method - Cost basis method determining lot order
 * @returns Ordered lots with remaining quantity > 0
 */
const selectLots = async (
  cryptoAssetId: string,
  method: CostBasisMethod,
): Promise<SelectCryptoLot[]> => {
  const orderClause = {
    fifo: asc(cryptoLotTable.acquiredAt),
    lifo: desc(cryptoLotTable.acquiredAt),
    hifo: desc(cryptoLotTable.costPerUnit),
    acb: asc(cryptoLotTable.acquiredAt),
  }[method];

  return dbPool
    .select()
    .from(cryptoLotTable)
    .where(
      and(
        eq(cryptoLotTable.cryptoAssetId, cryptoAssetId),
        gt(cryptoLotTable.remainingQuantity, "0"),
      ),
    )
    .orderBy(orderClause);
};

/**
 * Calculate the weighted average cost per unit across all available lots.
 * @param lots - Available lots to average
 * @returns Weighted average cost per unit as a string
 */
const calculateAverageCost = (lots: SelectCryptoLot[]): string => {
  let totalCost = 0;
  let totalQuantity = 0;

  for (const lot of lots) {
    const remaining = Number(lot.remainingQuantity);
    const cost = Number(lot.costPerUnit);
    totalCost += remaining * cost;
    totalQuantity += remaining;
  }

  if (totalQuantity === 0) return "0";

  return (totalCost / totalQuantity).toFixed(4);
};

/**
 * Dispose lots using a specific cost basis method, calculating realized gain/loss.
 *
 * For FIFO/LIFO/HIFO, lots are consumed in the method-defined order until the
 * disposal quantity is fulfilled. Partial lot consumption is supported.
 *
 * For ACB, cost basis is calculated using the weighted average cost across all
 * available lots, and lots are consumed in FIFO order.
 * @param params - Disposal parameters
 * @returns Disposal result with lots used and realized gain/loss
 */
const disposeLot = async (
  params: DisposeLotParams,
): Promise<DisposalResult> => {
  const { cryptoAssetId, quantity, proceedsPerUnit, disposedAt } = params;

  // Look up the asset to get its cost basis method
  const [asset] = await dbPool
    .select()
    .from(cryptoAssetTable)
    .where(eq(cryptoAssetTable.id, cryptoAssetId));

  if (!asset) {
    throw new Error(`Crypto asset not found: ${cryptoAssetId}`);
  }

  const method = asset.costBasisMethod as CostBasisMethod;
  const lots = await selectLots(cryptoAssetId, method);

  let remainingToDispose = Number(quantity);
  const proceeds = Number(proceedsPerUnit);
  const lotsUsed: LotDisposal[] = [];

  // For ACB, use weighted average cost instead of individual lot costs
  const avgCost = method === "acb" ? Number(calculateAverageCost(lots)) : 0;

  for (const lot of lots) {
    if (remainingToDispose <= 0) break;

    const available = Number(lot.remainingQuantity);
    const quantityFromLot = Math.min(available, remainingToDispose);
    const costPerUnit = method === "acb" ? avgCost : Number(lot.costPerUnit);
    const lotCostBasis = quantityFromLot * costPerUnit;
    const lotProceeds = quantityFromLot * proceeds;
    const gainLoss = lotProceeds - lotCostBasis;

    const newRemaining = available - quantityFromLot;

    // Update the lot's remaining quantity (and mark fully disposed)
    await dbPool
      .update(cryptoLotTable)
      .set({
        remainingQuantity: newRemaining.toFixed(18),
        ...(newRemaining === 0
          ? {
              disposedAt,
              proceedsPerUnit: proceedsPerUnit,
            }
          : {}),
      })
      .where(eq(cryptoLotTable.id, lot.id));

    lotsUsed.push({
      lotId: lot.id,
      quantityDisposed: quantityFromLot.toFixed(18),
      costBasis: lotCostBasis.toFixed(4),
      proceeds: lotProceeds.toFixed(4),
      gainLoss: gainLoss.toFixed(4),
    });

    remainingToDispose -= quantityFromLot;
  }

  if (remainingToDispose > 1e-12) {
    throw new Error(
      `Insufficient lots: ${remainingToDispose.toFixed(18)} units remaining to dispose`,
    );
  }

  const totalCostBasis = lotsUsed.reduce(
    (sum, l) => sum + Number(l.costBasis),
    0,
  );
  const totalProceeds = lotsUsed.reduce(
    (sum, l) => sum + Number(l.proceeds),
    0,
  );

  return {
    lotsUsed,
    totalCostBasis: totalCostBasis.toFixed(4),
    totalProceeds: totalProceeds.toFixed(4),
    realizedGainLoss: (totalProceeds - totalCostBasis).toFixed(4),
  };
};

/**
 * Calculate unrealized gains for all undisposed lots of a crypto asset.
 * @param cryptoAssetId - Asset to calculate unrealized gains for
 * @param currentPriceUsd - Current fair market value per unit in USD
 * @returns Per-lot and aggregate unrealized gain/loss
 */
const getUnrealizedGains = async (
  cryptoAssetId: string,
  currentPriceUsd: number,
): Promise<UnrealizedResult> => {
  const lots = await dbPool
    .select()
    .from(cryptoLotTable)
    .where(
      and(
        eq(cryptoLotTable.cryptoAssetId, cryptoAssetId),
        gt(cryptoLotTable.remainingQuantity, "0"),
      ),
    )
    .orderBy(asc(cryptoLotTable.acquiredAt));

  const unrealizedLots: UnrealizedLot[] = lots.map((lot) => {
    const remaining = Number(lot.remainingQuantity);
    const costBasis = remaining * Number(lot.costPerUnit);
    const currentValue = remaining * currentPriceUsd;
    const unrealizedGainLoss = currentValue - costBasis;

    return {
      lotId: lot.id,
      acquiredAt: lot.acquiredAt,
      remainingQuantity: lot.remainingQuantity,
      costPerUnit: lot.costPerUnit,
      costBasis: costBasis.toFixed(4),
      currentValue: currentValue.toFixed(4),
      unrealizedGainLoss: unrealizedGainLoss.toFixed(4),
    };
  });

  const totalCostBasis = unrealizedLots.reduce(
    (sum, l) => sum + Number(l.costBasis),
    0,
  );
  const totalCurrentValue = unrealizedLots.reduce(
    (sum, l) => sum + Number(l.currentValue),
    0,
  );

  return {
    lots: unrealizedLots,
    totalCostBasis: totalCostBasis.toFixed(4),
    totalCurrentValue: totalCurrentValue.toFixed(4),
    totalUnrealizedGainLoss: (totalCurrentValue - totalCostBasis).toFixed(4),
  };
};

/**
 * List all lots for a crypto asset.
 * @param cryptoAssetId - Asset to list lots for
 * @returns All lots ordered by acquisition date
 */
const listLots = async (cryptoAssetId: string): Promise<SelectCryptoLot[]> =>
  dbPool
    .select()
    .from(cryptoLotTable)
    .where(eq(cryptoLotTable.cryptoAssetId, cryptoAssetId))
    .orderBy(asc(cryptoLotTable.acquiredAt));

export {
  acquireLot,
  calculateAverageCost,
  disposeLot,
  getUnrealizedGains,
  listLots,
  selectLots,
};

export type {
  AcquireLotParams,
  CostBasisMethod,
  DisposalResult,
  DisposeLotParams,
  LotDisposal,
  UnrealizedLot,
  UnrealizedResult,
};
