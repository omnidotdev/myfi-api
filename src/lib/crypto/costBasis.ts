import { and, asc, desc, eq, gt } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable, cryptoLotTable } from "lib/db/schema";
import { computeRealizedDisposal } from "./costBasisCalc";

import type { SelectCryptoLot } from "lib/db/schema";
import type { CostBasisMethod } from "./costBasisCalc";

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

  // The realized gain/loss math (and insufficient-lots guard) is pure and
  // fixture-tested in costBasisCalc; here we only persist the consumption
  const { result, consumption } = computeRealizedDisposal({
    lots,
    quantity,
    proceedsPerUnit,
    method,
  });

  for (const { lotId, newRemaining, fullyConsumed } of consumption) {
    await dbPool
      .update(cryptoLotTable)
      .set({
        remainingQuantity: newRemaining.toFixed(18),
        // Mark fully disposed lots with the disposal date and proceeds
        ...(fullyConsumed ? { disposedAt, proceedsPerUnit } : {}),
      })
      .where(eq(cryptoLotTable.id, lotId));
  }

  return result;
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

export { acquireLot, disposeLot, getUnrealizedGains, listLots };
