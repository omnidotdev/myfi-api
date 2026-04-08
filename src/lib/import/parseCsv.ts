import type { ParsedTransaction } from "./importTransactions";

type CsvColumnMap = {
  date: number;
  amount: number;
  memo: number;
  debit?: number;
  credit?: number;
};

/**
 * Detect column indices from header row.
 * Handles common bank CSV formats (Chase, BofA, Wells Fargo, Capital One, etc.)
 */
const detectColumns = (headers: string[]): CsvColumnMap | null => {
  const normalized = headers.map((h) => h.toLowerCase().trim());

  const dateIdx = normalized.findIndex((h) =>
    ["date", "transaction date", "posting date", "trans date"].includes(h),
  );

  const memoIdx = normalized.findIndex((h) =>
    [
      "description",
      "memo",
      "name",
      "merchant",
      "transaction description",
      "payee",
      "details",
    ].includes(h),
  );

  if (dateIdx === -1 || memoIdx === -1) return null;

  // Some banks use a single "amount" column (negative = debit)
  const amountIdx = normalized.findIndex((h) =>
    ["amount", "transaction amount"].includes(h),
  );

  if (amountIdx !== -1) {
    return { date: dateIdx, amount: amountIdx, memo: memoIdx };
  }

  // Some banks use separate debit/credit columns
  const debitIdx = normalized.findIndex((h) =>
    ["debit", "debit amount", "withdrawals"].includes(h),
  );
  const creditIdx = normalized.findIndex((h) =>
    ["credit", "credit amount", "deposits"].includes(h),
  );

  if (debitIdx !== -1 || creditIdx !== -1) {
    return {
      date: dateIdx,
      amount: -1,
      memo: memoIdx,
      debit: debitIdx !== -1 ? debitIdx : undefined,
      credit: creditIdx !== -1 ? creditIdx : undefined,
    };
  }

  return null;
};

/**
 * Parse a date string in common US formats.
 * Handles MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
 */
const parseDate = (dateStr: string): string => {
  const trimmed = dateStr.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`,
    ).toISOString();
  }

  // Fallback
  return new Date(trimmed).toISOString();
};

/**
 * Parse a CSV string into an array of rows (handling quoted fields)
 */
const splitCsvRows = (csv: string): string[][] => {
  const rows: string[][] = [];
  const lines = csv.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (char === '"') {
        if (inQuotes && trimmed[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
};

/**
 * Parse bank CSV content into transactions.
 * Auto-detects column layout from headers.
 */
const parseCsv = (content: string): ParsedTransaction[] => {
  const rows = splitCsvRows(content);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const columns = detectColumns(headers);
  if (!columns) {
    throw new Error(
      "Could not detect CSV column layout. Expected columns: date, description/memo, amount (or debit/credit)",
    );
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[columns.date]) continue;

    let amount: number;

    if (columns.amount !== -1) {
      // Single amount column (negative = expense, positive = income)
      const rawAmount = Number.parseFloat(
        row[columns.amount]?.replace(/[$,]/g, "") ?? "0",
      );
      if (Number.isNaN(rawAmount) || rawAmount === 0) continue;
      // Normalize: negative = expense (outflow), positive = income
      amount = rawAmount;
    } else {
      // Separate debit/credit columns
      const debit =
        columns.debit !== undefined
          ? Number.parseFloat(
              row[columns.debit]?.replace(/[$,]/g, "") ?? "0",
            ) || 0
          : 0;
      const credit =
        columns.credit !== undefined
          ? Number.parseFloat(
              row[columns.credit]?.replace(/[$,]/g, "") ?? "0",
            ) || 0
          : 0;

      if (debit === 0 && credit === 0) continue;

      // Debit = expense (positive amount), credit = income (negative amount)
      amount = debit > 0 ? debit : -credit;
    }

    const memo = row[columns.memo] ?? "CSV import";

    transactions.push({
      date: parseDate(row[columns.date]),
      amount,
      memo,
      merchantName: memo,
      referenceId: null,
    });
  }

  return transactions;
};

export default parseCsv;

export { splitCsvRows, detectColumns };
export type { CsvColumnMap };
