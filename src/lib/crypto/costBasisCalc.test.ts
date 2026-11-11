import { describe, expect, test } from "bun:test";

import { computeRealizedDisposal, weightedAverageCost } from "./costBasisCalc";

import type { DisposalLotInput } from "./costBasisCalc";

// Three 1-unit lots where acquisition order and cost order deliberately differ,
// so FIFO, LIFO, HIFO and ACB each yield a distinct realized gain/loss
const lots: DisposalLotInput[] = [
  {
    id: "lot-a",
    acquiredAt: "2024-01-01T00:00:00Z",
    remainingQuantity: "1",
    costPerUnit: "30000",
  },
  {
    id: "lot-b",
    acquiredAt: "2024-02-01T00:00:00Z",
    remainingQuantity: "1",
    costPerUnit: "10000",
  },
  {
    id: "lot-c",
    acquiredAt: "2024-03-01T00:00:00Z",
    remainingQuantity: "1",
    costPerUnit: "20000",
  },
];

// Dispose 1.5 units at 25000/unit (proceeds 37500 total in every method)
const disposeArgs = { quantity: "1.5", proceedsPerUnit: "25000" } as const;

describe("computeRealizedDisposal", () => {
  test("FIFO consumes oldest lots first", () => {
    const { result } = computeRealizedDisposal({
      lots,
      ...disposeArgs,
      method: "fifo",
    });

    expect(result.lotsUsed.map((l) => l.lotId)).toEqual(["lot-a", "lot-b"]);
    expect(result.totalCostBasis).toBe("35000.0000");
    expect(result.totalProceeds).toBe("37500.0000");
    expect(result.realizedGainLoss).toBe("2500.0000");
  });

  test("LIFO consumes newest lots first", () => {
    const { result } = computeRealizedDisposal({
      lots,
      ...disposeArgs,
      method: "lifo",
    });

    expect(result.lotsUsed.map((l) => l.lotId)).toEqual(["lot-c", "lot-b"]);
    expect(result.realizedGainLoss).toBe("12500.0000");
  });

  test("HIFO consumes highest-cost lots first", () => {
    const { result } = computeRealizedDisposal({
      lots,
      ...disposeArgs,
      method: "hifo",
    });

    expect(result.lotsUsed.map((l) => l.lotId)).toEqual(["lot-a", "lot-c"]);
    expect(result.realizedGainLoss).toBe("-2500.0000");
  });

  test("ACB uses the weighted average cost across all lots", () => {
    const { result } = computeRealizedDisposal({
      lots,
      ...disposeArgs,
      method: "acb",
    });

    // avg cost = (30000 + 10000 + 20000) / 3 = 20000; basis = 1.5 * 20000 = 30000
    expect(result.totalCostBasis).toBe("30000.0000");
    expect(result.realizedGainLoss).toBe("7500.0000");
  });

  test("records the per-lot consumption plan for the caller's DB writes", () => {
    const { consumption } = computeRealizedDisposal({
      lots,
      ...disposeArgs,
      method: "fifo",
    });

    // lot-a fully consumed (1 of 1), lot-b partially (0.5 of 1)
    expect(consumption).toEqual([
      { lotId: "lot-a", newRemaining: 0, fullyConsumed: true },
      { lotId: "lot-b", newRemaining: 0.5, fullyConsumed: false },
    ]);
  });

  test("throws when available lots cannot cover the disposal", () => {
    expect(() =>
      computeRealizedDisposal({
        lots,
        quantity: "5",
        proceedsPerUnit: "25000",
        method: "fifo",
      }),
    ).toThrow(/Insufficient lots/);
  });

  test("supports a single partial lot disposal", () => {
    const { result, consumption } = computeRealizedDisposal({
      lots: [lots[0]],
      quantity: "0.25",
      proceedsPerUnit: "40000",
      method: "fifo",
    });

    // 0.25 @ cost 30000 = 7500 basis; proceeds 0.25 * 40000 = 10000; gain 2500
    expect(result.totalCostBasis).toBe("7500.0000");
    expect(result.totalProceeds).toBe("10000.0000");
    expect(result.realizedGainLoss).toBe("2500.0000");
    expect(consumption[0]).toEqual({
      lotId: "lot-a",
      newRemaining: 0.75,
      fullyConsumed: false,
    });
  });
});

describe("weightedAverageCost", () => {
  test("averages cost per unit weighted by remaining quantity", () => {
    expect(
      weightedAverageCost([
        {
          id: "x",
          acquiredAt: "2024-01-01",
          remainingQuantity: "2",
          costPerUnit: "10",
        },
        {
          id: "y",
          acquiredAt: "2024-01-02",
          remainingQuantity: "1",
          costPerUnit: "40",
        },
      ]),
    ).toBe("20.0000");
  });

  test("returns 0 when there is no remaining quantity", () => {
    expect(weightedAverageCost([])).toBe("0");
  });
});
