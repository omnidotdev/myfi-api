/**
 * Pure builders for month-end close notification emails, kept free of DB and
 * provider imports so they are cheap to unit test.
 */

const periodLabel = (year: number, month: number): string =>
  `${new Date(year, month - 1).toLocaleString("en-US", { month: "long" })} ${year}`;

/** The "your books are ready" email sent when a period closes with no blockers. */
export const buildBooksReadyEmail = (params: {
  bookName: string;
  year: number;
  month: number;
}): { subject: string; body: string } => {
  const { bookName, year, month } = params;
  const label = periodLabel(year, month);

  const subject = `[MyFi] Books are ready for "${bookName}" (${label})`;
  const body = [
    `The books for "${bookName}" are closed and ready for ${label}.`,
    "",
    "The period passed close review (trial balance ties out and no items were left pending), so its financial statements are final.",
    "",
    "You can review the closed period's reports in MyFi any time.",
  ].join("\n");

  return { subject, body };
};
