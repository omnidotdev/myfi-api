import ExcelJS from "exceljs";

/**
 * A cell that already reads as currency (fmt() output starts with "$") is
 * written to the sheet as a number with an accounting format so Excel can sum
 * and filter it, rather than as inert text
 */
const CURRENCY_PREFIX = "$";
const ACCOUNTING_FORMAT = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_)';

/** Parse a display currency string ("$1,234.56", "-$20.00") back to a number */
const parseCurrency = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed.includes(CURRENCY_PREFIX)) return null;
  const negative = trimmed.startsWith("-") || /^\(.*\)$/.test(trimmed);
  const digits = trimmed.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const n = Number.parseFloat(digits);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
};

/**
 * Render a report's flat tabular shape to a styled XLSX workbook buffer.
 * Header and totals rows are bold; currency-looking cells are written as real
 * numbers with an accounting number format so the sheet stays computable
 */
const renderReportXlsx = async (params: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  totals?: string[];
}): Promise<Uint8Array> => {
  const { title, subtitle, headers, rows, totals } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MyFi";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 31) || "Report");

  const columnCount = headers.length;

  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, Math.max(columnCount, 1));

  if (subtitle) {
    const subtitleRow = sheet.addRow([subtitle]);
    subtitleRow.font = { color: { argb: "FF666666" } };
    sheet.mergeCells(
      subtitleRow.number,
      1,
      subtitleRow.number,
      Math.max(columnCount, 1),
    );
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: "medium" } };
  });

  const writeBodyRow = (values: string[], isTotals: boolean) => {
    const row = sheet.addRow(values.map((cell) => parseCurrency(cell) ?? cell));
    row.eachCell((cell, col) => {
      if (typeof cell.value === "number") {
        cell.numFmt = ACCOUNTING_FORMAT;
        cell.alignment = { horizontal: "right" };
      }
      if (isTotals) {
        cell.font = { bold: true };
        cell.border = { top: { style: "medium" } };
      }
      // keep the accounting format even when a totals cell is text (e.g. a label)
      if (isTotals && typeof cell.value !== "number" && col > 1) {
        cell.alignment = { horizontal: "right" };
      }
    });
    return row;
  };

  for (const row of rows) writeBodyRow(row, false);
  if (totals) writeBodyRow(totals, true);

  // Size columns to the widest cell (bounded), first column a bit roomier
  sheet.columns.forEach((column, index) => {
    let max = index === 0 ? 24 : 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > max) max = len;
    });
    column.width = Math.min(max, 48);
  });

  sheet.views = [{ state: "frozen", ySplit: 4 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

export default renderReportXlsx;
