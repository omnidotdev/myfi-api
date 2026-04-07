/**
 * Wrap report data in a printable HTML document
 */
const renderReportHtml = (params: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  totals?: string[];
}): string => {
  const { title, subtitle, headers, rows, totals } = params;

  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #666; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #333; font-weight: 600; }
    td { padding: 0.5rem; border-bottom: 1px solid #e5e5e5; }
    .totals td { border-top: 2px solid #333; font-weight: 600; }
    .right { text-align: right; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    ${totals ? `<tfoot><tr class="totals">${totals.map((t) => `<td>${t}</td>`).join("")}</tr></tfoot>` : ""}
  </table>
</body>
</html>`;
};

export default renderReportHtml;
