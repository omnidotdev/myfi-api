import { fromUnits, toUnits } from "lib/invoicing/invoicePosting";

/**
 * Weighted-average cost after receiving stock. The new average blends the
 * existing on-hand value with the received value:
 *   (onHand*avgCost + receiveQty*receiveUnitCost) / (onHand + receiveQty)
 * Rounded to four decimals. When the resulting quantity is zero, the average
 * cost is left unchanged
 */
export const newAverageCost = (
  quantityOnHand: number,
  averageCost: number,
  receiveQuantity: number,
  receiveUnitCost: number,
): number => {
  const newQty = quantityOnHand + receiveQuantity;
  if (newQty <= 0) return averageCost;
  const existingValue = quantityOnHand * averageCost;
  const receivedValue = receiveQuantity * receiveUnitCost;
  return fromUnits(
    Math.round(((existingValue + receivedValue) / newQty) * 10000),
  );
};

/** Total value of a stock movement (quantity times unit cost), at 4 decimals */
export const movementValue = (quantity: number, unitCost: number): number =>
  fromUnits(Math.round(quantity * unitCost * 10000));

/** Whether a sale quantity is available given the quantity on hand (in units) */
export const hasSufficientStock = (
  quantityOnHand: number,
  saleQuantity: number,
): boolean => toUnits(saleQuantity) <= toUnits(quantityOnHand);
