/**
 * Format a numeric string as display currency for an exported report.
 *
 * Negatives use the accounting-parentheses convention, e.g. `($1,234.50)`, so a
 * loss, an accumulated deficit, or a contra balance is never indistinguishable
 * from a positive amount. A value that rounds to zero is treated as zero so it
 * does not render as a negative.
 */
export const formatReportCurrency = (value: string): string => {
  const n = Number.parseFloat(value);
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Math.round to cents so -0.001 is not shown as a negative
  const isNegative = Math.round(safe * 100) < 0;

  return isNegative ? `($${abs})` : `$${abs}`;
};
