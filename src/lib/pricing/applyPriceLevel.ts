import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

/**
 * Apply a price level's signed percentage adjustment to a base unit price and
 * round to the money scale (ten-thousandths). A negative percent is a discount,
 * a positive one a markup. The result never goes below zero
 */
export const applyPriceLevel = (
  basePrice: number,
  adjustmentPercent: number,
): number => {
  const adjustedUnits = Math.round(
    toUnits(basePrice) * (1 + adjustmentPercent / 100),
  );
  return fromUnits(Math.max(0, adjustedUnits));
};
