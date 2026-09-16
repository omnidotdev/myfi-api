export type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

/** Add whole months to a YYYY-MM-DD date, clamping to the last valid day of the
 * target month (so Jan 31 + 1 month is Feb 28/29, not Mar 3) */
const addMonths = (date: string, months: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${target.getUTCFullYear()}-${mm}-${dd}`;
};

const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};

/**
 * The next occurrence date after a given date for a recurring frequency. Dates
 * are YYYY-MM-DD; monthly and longer steps clamp to the end of the target month
 */
export const advanceDate = (
  date: string,
  frequency: RecurringFrequency,
): string => {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "yearly":
      return addMonths(date, 12);
    default:
      throw new Error(`Unknown recurring frequency: ${frequency}`);
  }
};
