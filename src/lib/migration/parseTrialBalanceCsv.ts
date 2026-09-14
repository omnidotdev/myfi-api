import { splitCsvRows } from "lib/import/parseCsv";

/** One account row parsed from a QuickBooks Trial Balance export */
interface ParsedTrialBalanceAccount {
  name: string;
  /** Leading account number when the export prefixes one (e.g. "1000 Checking") */
  accountNum?: string;
  debit: number;
  credit: number;
}

interface ParsedTrialBalance {
  /** The "As of" date text from the report preamble, when present */
  asOf?: string;
  accounts: ParsedTrialBalanceAccount[];
}

/**
 * Parse a money cell from a QuickBooks report: strips the currency symbol,
 * thousands separators, and whitespace, and reads parenthesized values as
 * negative. An empty or non-numeric cell is 0
 */
const parseAmount = (raw: string): number => {
  const stripped = raw.replace(/[$\s,]/g, "");
  if (!stripped) return 0;

  const negative = /^\(.*\)$/.test(stripped);
  const num = Number.parseFloat(stripped.replace(/[()]/g, ""));
  if (Number.isNaN(num)) return 0;

  return negative ? -num : num;
};

/**
 * Parse a QuickBooks Online "Trial Balance" report exported as CSV into a flat
 * list of account balances.
 *
 * The export carries a title/company/as-of preamble, then a header row with
 * Debit and Credit columns, then one row per account, then a TOTAL row. This
 * skips the preamble, the TOTAL row, subtotal ("Total ...") rows, and any
 * name-only or zero rows (section headers), extracting each account's name and
 * its Debit/Credit amounts. The account-name column is the first non-empty cell
 * to the left of the Debit column, so a leading indent/blank column is tolerated
 */
const parseTrialBalanceCsv = (content: string): ParsedTrialBalance => {
  // Strip a UTF-8 BOM some exports prepend, which would otherwise corrupt the
  // first cell
  const rows = splitCsvRows(content.replace(/^﻿/, ""));

  if (rows.length === 0) {
    throw new Error("Trial Balance file is empty");
  }

  // As-of date from a preamble like "As of August 31, 2026". Join the row so it
  // is captured whether the export quoted the date (one cell) or left the comma
  // unquoted (split across cells)
  let asOf: string | undefined;
  for (const row of rows) {
    // Drop empty trailing cells so a "...,," row does not append ", ," to the date
    const match = row
      .filter(Boolean)
      .join(", ")
      .match(/as of\s+(.+)/i);
    if (match?.[1]) {
      asOf = match[1].trim();
      break;
    }
  }

  // Locate the header row that names the Debit and Credit columns
  let headerIndex = -1;
  let debitIndex = -1;
  let creditIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map((cell) => cell.toLowerCase());
    const d = lower.indexOf("debit");
    const c = lower.indexOf("credit");
    if (d !== -1 && c !== -1) {
      headerIndex = i;
      debitIndex = d;
      creditIndex = c;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error(
      "Could not find Debit and Credit columns; expected a QuickBooks Trial Balance export",
    );
  }

  const accounts: ParsedTrialBalanceAccount[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    // Name is the first non-empty cell left of the Debit column, so a leading
    // blank/indent column does not hide it
    const rawName = row
      .slice(0, debitIndex)
      .map((cell) => cell.trim())
      .find(Boolean);
    if (!rawName) continue;

    // Skip the grand total and any subtotal rows
    if (/^total\b/i.test(rawName)) continue;

    const debit = parseAmount(row[debitIndex] ?? "");
    const credit = parseAmount(row[creditIndex] ?? "");

    // Skip section-header / zero rows: a trial balance only lists accounts that
    // carry a balance
    if (debit === 0 && credit === 0) continue;

    // QuickBooks sub-accounts are "Parent:Child" (e.g. "6000 Payroll &
    // Related:6010 Salary & Wages"); the leaf carries the balance, so key off it
    const leaf = rawName.split(":").pop()?.trim() ?? rawName;

    // Split a leading account number ("1010 Checking") from the leaf name
    let name = leaf;
    let accountNum: string | undefined;
    const numMatch = leaf.match(/^(\d[\d.-]*)\s+(.+)$/);
    if (numMatch?.[1] && numMatch[2]) {
      accountNum = numMatch[1];
      name = numMatch[2].trim();
    }

    accounts.push({ name, accountNum, debit, credit });
  }

  if (accounts.length === 0) {
    throw new Error("No account rows found in the Trial Balance");
  }

  return { asOf, accounts };
};

export { parseTrialBalanceCsv };
export type { ParsedTrialBalance, ParsedTrialBalanceAccount };
