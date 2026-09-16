import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 792; // US Letter landscape
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const FONT_SIZE = 9;
const HEADER_SIZE = 9;
const ROW_HEIGHT = 16;
const TITLE_SIZE = 16;
const SUBTITLE_SIZE = 10;

/** A cell reads as a number/currency when it starts with $, -, ( or a digit */
const isNumericCell = (value: string): boolean =>
  /^[-($\d]/.test(value.trim()) && /\d/.test(value);

/**
 * Render a report's flat tabular shape to a PDF buffer. Landscape Letter with a
 * bold title, subtitle, a bold header row, right-aligned numeric columns, and a
 * bold totals row. Long text is truncated to its column; rows paginate with the
 * header repeated on each page
 */
const renderReportPdf = async (params: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  totals?: string[];
}): Promise<Uint8Array> => {
  const { title, subtitle, headers, rows, totals } = params;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const columnCount = Math.max(headers.length, 1);
  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  // First column carries labels, so give it double weight; the rest are equal
  const weights = headers.map((_, i) => (i === 0 ? 2 : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const colWidths = weights.map((w) => (w / weightSum) * usableWidth);
  const colX: number[] = [];
  let acc = MARGIN;
  for (const w of colWidths) {
    colX.push(acc);
    acc += w;
  }

  // Which columns are numeric (right-aligned): decide from the first data row
  const numericCol = headers.map((_, i) =>
    rows.length > 0 ? isNumericCell(rows[0]?.[i] ?? "") : false,
  );

  const truncate = (
    text: string,
    maxWidth: number,
    f: typeof font,
    size: number,
  ): string => {
    if (f.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > maxWidth) {
      t = t.slice(0, -1);
    }
    return `${t}...`;
  };

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Title + subtitle on the first page only
  page.drawText(title, {
    x: MARGIN,
    y: y - TITLE_SIZE,
    size: TITLE_SIZE,
    font: bold,
  });
  y -= TITLE_SIZE + 8;
  if (subtitle) {
    page.drawText(subtitle, {
      x: MARGIN,
      y: y - SUBTITLE_SIZE,
      size: SUBTITLE_SIZE,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= SUBTITLE_SIZE + 10;
  } else {
    y -= 6;
  }

  const drawCells = (
    cells: string[],
    f: typeof font,
    size: number,
    rowY: number,
  ) => {
    for (let i = 0; i < columnCount; i++) {
      const raw = cells[i] ?? "";
      const cellWidth = colWidths[i] ?? usableWidth;
      const padded = cellWidth - 8;
      const text = truncate(raw, padded, f, size);
      const textWidth = f.widthOfTextAtSize(text, size);
      const left = colX[i] ?? MARGIN;
      const x = numericCol[i] ? left + cellWidth - 4 - textWidth : left + 2;
      page.drawText(text, { x, y: rowY, size, font: f });
    }
  };

  const drawHeader = () => {
    drawCells(headers, bold, HEADER_SIZE, y - HEADER_SIZE);
    y -= ROW_HEIGHT;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
      thickness: 1,
      color: rgb(0.2, 0.2, 0.2),
    });
  };

  const ensureSpace = () => {
    if (y - ROW_HEIGHT < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawHeader();
    }
  };

  drawHeader();

  for (const row of rows) {
    ensureSpace();
    drawCells(row, font, FONT_SIZE, y - FONT_SIZE);
    y -= ROW_HEIGHT;
  }

  if (totals) {
    ensureSpace();
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
      thickness: 1,
      color: rgb(0.2, 0.2, 0.2),
    });
    drawCells(totals, bold, FONT_SIZE, y - FONT_SIZE);
    y -= ROW_HEIGHT;
  }

  return doc.save();
};

export default renderReportPdf;
