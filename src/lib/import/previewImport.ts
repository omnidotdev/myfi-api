import { detectColumns, splitCsvRows } from "./parseCsv";
import parseOfx from "./parseOfx";

import type { ParsedTransaction } from "./importTransactions";
import type { CsvColumnMap } from "./parseCsv";

type CsvPreviewResult = {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  columnMap: CsvColumnMap | null;
  autoDetected: boolean;
};

type OfxPreviewResult = {
  transactions: ParsedTransaction[];
  totalRows: number;
};

const previewCsv = (
  content: string,
  overrideMap?: CsvColumnMap,
): CsvPreviewResult => {
  const rows = splitCsvRows(content);
  if (rows.length < 2) {
    return {
      headers: rows[0] ?? [],
      sampleRows: [],
      totalRows: 0,
      columnMap: null,
      autoDetected: false,
    };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  let columnMap: CsvColumnMap | null;
  let autoDetected: boolean;

  if (overrideMap) {
    columnMap = overrideMap;
    autoDetected = false;
  } else {
    columnMap = detectColumns(headers);
    autoDetected = columnMap !== null;
  }

  return {
    headers,
    sampleRows: dataRows.slice(0, 10),
    totalRows: dataRows.length,
    columnMap,
    autoDetected,
  };
};

const previewOfx = (content: string): OfxPreviewResult => {
  const transactions = parseOfx(content);
  return {
    transactions,
    totalRows: transactions.length,
  };
};

export { previewCsv, previewOfx };
