/**
 * Pure cost-basis math for crypto lot disposals. No database access, so the
 * realized gain/loss logic that feeds tax forms (Form 8949) can be exercised
 * deterministically against fixtures. The DB-bound `disposeLot` orchestrator
 * composes this with lot selection and persistence
 */

export type CostBasisMethod = "fifo" | "lifo" | "hifo" | "acb";

/** The lot fields the calculation needs; a subset of the stored lot row */
export type DisposalLotInput = {
  id: string;
  acquiredAt: string;
  remainingQuantity: string;
  costPerUnit: string;
};

type RealizedLotDisposal = {
  lotId: string;
  quantityDisposed: string;
  costBasis: string;
  proceeds: string;
  gainLoss: string;
};

type RealizedDisposalResult = {
  lotsUsed: RealizedLotDisposal[];
  totalCostBasis: string;
  totalProceeds: string;
  realizedGainLoss: string;
};

/** Per-lot bookkeeping the caller needs to persist remaining quantities */
type LotConsumption = {
  lotId: string;
  newRemaining: number;
  fullyConsumed: boolean;
};

type DisposalPlan = {
  result: RealizedDisposalResult;
  consumption: LotConsumption[];
};

type ComputeParams = {
  lots: DisposalLotInput[];
  quantity: string;
  proceedsPerUnit: string;
  method: CostBasisMethod;
};

/**
 * Order lots by the given cost-basis method, mirroring the database ordering
 * used when lots are selected for disposal.
 * @param lots - Lots with remaining quantity
 * @param method - Cost basis method determining lot order
 * @returns A new, ordered array (input is not mutated)
 */
const orderLotsByMethod = (
  lots: DisposalLotInput[],
  method: CostBasisMethod,
): DisposalLotInput[] => {
  const ordered = [...lots];

  switch (method) {
    case "lifo":
      // Newest acquisition first
      ordered.sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
      break;
    case "hifo":
      // Highest cost per unit first
      ordered.sort((a, b) => Number(b.costPerUnit) - Number(a.costPerUnit));
      break;
    default:
      // FIFO and ACB both consume oldest acquisition first
      ordered.sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt));
      break;
  }

  return ordered;
};

/**
 * Weighted average cost per unit across the given lots, weighted by remaining
 * quantity. Used for the ACB (adjusted cost base) method.
 * @param lots - Lots to average
 * @returns Weighted average cost per unit, as a fixed(4) string ("0" when empty)
 */
export const weightedAverageCost = (lots: DisposalLotInput[]): string => {
  let totalCost = 0;
  let totalQuantity = 0;

  for (const lot of lots) {
    const remaining = Number(lot.remainingQuantity);
    totalCost += remaining * Number(lot.costPerUnit);
    totalQuantity += remaining;
  }

  if (totalQuantity === 0) return "0";

  return (totalCost / totalQuantity).toFixed(4);
};

/**
 * Compute the realized gain/loss for disposing `quantity` units at
 * `proceedsPerUnit`, consuming lots in the method-defined order. Partial lot
 * consumption is supported. For ACB, every consumed unit is costed at the
 * weighted average across all available lots.
 * @param params - Lots, disposal quantity, proceeds per unit, and method
 * @returns The realized result plus the per-lot consumption plan
 * @throws When available lots cannot cover the requested quantity
 */
export const computeRealizedDisposal = ({
  lots,
  quantity,
  proceedsPerUnit,
  method,
}: ComputeParams): DisposalPlan => {
  const ordered = orderLotsByMethod(lots, method);

  let remainingToDispose = Number(quantity);
  const proceeds = Number(proceedsPerUnit);
  const lotsUsed: RealizedLotDisposal[] = [];
  const consumption: LotConsumption[] = [];

  // ACB costs every unit at the weighted average rather than each lot's own cost
  const avgCost = method === "acb" ? Number(weightedAverageCost(lots)) : 0;

  for (const lot of ordered) {
    if (remainingToDispose <= 0) break;

    const available = Number(lot.remainingQuantity);
    const quantityFromLot = Math.min(available, remainingToDispose);
    const costPerUnit = method === "acb" ? avgCost : Number(lot.costPerUnit);
    const lotCostBasis = quantityFromLot * costPerUnit;
    const lotProceeds = quantityFromLot * proceeds;
    const gainLoss = lotProceeds - lotCostBasis;
    const newRemaining = available - quantityFromLot;

    lotsUsed.push({
      lotId: lot.id,
      quantityDisposed: quantityFromLot.toFixed(18),
      costBasis: lotCostBasis.toFixed(4),
      proceeds: lotProceeds.toFixed(4),
      gainLoss: gainLoss.toFixed(4),
    });

    consumption.push({
      lotId: lot.id,
      newRemaining,
      fullyConsumed: newRemaining === 0,
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
    result: {
      lotsUsed,
      totalCostBasis: totalCostBasis.toFixed(4),
      totalProceeds: totalProceeds.toFixed(4),
      realizedGainLoss: (totalProceeds - totalCostBasis).toFixed(4),
    },
    consumption,
  };
};
