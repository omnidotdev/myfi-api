import { getVendorSpend } from "lib/spending";
import { generate1099Nec } from "lib/tax";
import generateBalanceSheet from "./balanceSheet";
import generateCashFlow from "./cashFlow";
import generateGeneralLedger from "./generalLedger";
import renderReportHtml from "./htmlRenderer";
import generatePayrollSummary from "./payrollSummary";
import renderReportPdf from "./pdfRenderer";
import generateProfitAndLoss from "./profitAndLoss";
import { generateProjectPnl } from "./projectReport";
import getSalesByState from "./salesByState";
import generateSalesTaxReport from "./salesTax";
import generateTrialBalance from "./trialBalance";
import renderReportXlsx from "./xlsxRenderer";

export type ExportFormat = "html" | "csv" | "xlsx" | "pdf";

export const EXPORT_FORMATS: ExportFormat[] = ["html", "csv", "xlsx", "pdf"];

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ExportParams = {
  type: string;
  bookId: string;
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  year?: string;
  tagIds?: string[];
  projectId?: string;
  projectIds?: string[];
  accountId?: string;
  jurisdictionId?: string;
  basis?: "accrual" | "cash";
};

type ExportResult = {
  content: string | Uint8Array;
  contentType: string;
  filename: string;
};

/**
 * Escape a CSV cell value (wrap in quotes if it contains commas, quotes, or newlines)
 */
const escapeCsv = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

/**
 * Convert headers and rows to a CSV string
 */
const renderCsv = (headers: string[], rows: string[][]): string => {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];

  return lines.join("\n");
};

/**
 * Format a numeric string as currency for display
 */
const fmt = (value: string): string => {
  const n = Number.parseFloat(value);

  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Export a report in the requested format (HTML or CSV).
 * Dispatches to the appropriate report generator based on type,
 * then transforms the result into the requested output format.
 */
const exportReport = async (params: ExportParams): Promise<ExportResult> => {
  const {
    type,
    bookId,
    format,
    startDate,
    endDate,
    asOfDate,
    year,
    tagIds,
    projectId,
    projectIds,
    accountId,
    jurisdictionId,
    basis,
  } = params;

  let headers: string[];
  let rows: string[][];
  let totals: string[] | undefined;
  let title: string;
  let subtitle: string | undefined;
  let filenameBase: string;

  switch (type) {
    case "profit-and-loss": {
      if (!startDate || !endDate) {
        throw new Error(
          "startDate and endDate are required for profit-and-loss",
        );
      }

      const pnl = await generateProfitAndLoss({
        bookId,
        startDate,
        endDate,
        tagIds,
        projectIds,
        basis,
      });

      title = "Profit & Loss";
      subtitle = `${startDate} to ${endDate}${basis === "cash" ? " (cash basis)" : ""}`;
      filenameBase = `profit-and-loss_${startDate}_${endDate}`;
      headers = ["Account", "Type", "Amount"];

      rows = [
        ...pnl.revenue.map((r) => [
          r.accountName,
          "Revenue",
          fmt(r.netAmount ?? "0"),
        ]),
        ...pnl.expenses.map((e) => [
          e.accountName,
          "Expense",
          fmt(e.netAmount ?? "0"),
        ]),
      ];

      totals = ["Net Income", "", fmt(pnl.netIncome)];
      break;
    }

    case "balance-sheet": {
      if (!asOfDate) {
        throw new Error("asOfDate is required for balance-sheet");
      }

      const bs = await generateBalanceSheet({
        bookId,
        asOfDate,
        tagIds,
        projectIds,
      });

      title = "Balance Sheet";
      subtitle = `As of ${asOfDate}`;
      filenameBase = `balance-sheet_${asOfDate}`;
      headers = ["Account", "Type", "Balance"];

      rows = [
        ...bs.assets.map((a) => [a.accountName, "Asset", fmt(a.balance)]),
        ...bs.liabilities.map((l) => [
          l.accountName,
          "Liability",
          fmt(l.balance),
        ]),
        ...bs.equity.map((e) => [e.accountName, "Equity", fmt(e.balance)]),
      ];

      totals = [
        "Totals",
        "",
        `A: ${fmt(bs.totalAssets)} | L: ${fmt(bs.totalLiabilities)} | E: ${fmt(bs.totalEquity)}`,
      ];
      break;
    }

    case "trial-balance": {
      if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required for trial-balance");
      }

      const tb = await generateTrialBalance({
        bookId,
        startDate,
        endDate,
        tagIds,
        projectIds,
      });

      title = "Trial Balance";
      subtitle = `${startDate} to ${endDate}`;
      filenameBase = `trial-balance_${startDate}_${endDate}`;
      headers = ["Account", "Type", "Debits", "Credits"];

      rows = tb.accounts.map((a) => [
        a.accountName,
        a.accountType,
        fmt(a.debitTotal),
        fmt(a.creditTotal),
      ]);

      totals = ["Totals", "", fmt(tb.totalDebits), fmt(tb.totalCredits)];
      break;
    }

    case "1099-nec": {
      if (!year) {
        throw new Error("year is required for 1099-nec");
      }

      const nec = await generate1099Nec({
        bookId,
        year: Number.parseInt(year, 10),
      });

      title = "1099-NEC";
      subtitle = `Tax Year ${year}`;
      filenameBase = `1099-nec_${year}`;
      headers = ["Recipient", "TIN Type", "Compensation"];

      rows = nec.forms.map((f) => [
        f.recipientName,
        f.recipientTinType ?? "N/A",
        fmt(f.box1NonemployeeCompensation),
      ]);

      totals = ["Total", "", fmt(nec.totalAmount)];
      break;
    }

    case "cash-flow": {
      if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required for cash-flow");
      }

      const cf = await generateCashFlow({
        bookId,
        startDate,
        endDate,
        tagIds,
        projectIds,
      });

      title = "Cash Flow Statement";
      subtitle = `${startDate} to ${endDate}`;
      filenameBase = `cash-flow_${startDate}_${endDate}`;
      headers = ["Account", "Category", "Amount"];

      rows = [
        ...cf.operating.items.map((i) => [
          i.accountName,
          "Operating",
          fmt(i.netAmount),
        ]),
        ...cf.investing.items.map((i) => [
          i.accountName,
          "Investing",
          fmt(i.netAmount),
        ]),
        ...cf.financing.items.map((i) => [
          i.accountName,
          "Financing",
          fmt(i.netAmount),
        ]),
      ];

      totals = ["Net Cash Change", "", fmt(cf.netCashChange)];
      break;
    }

    case "general-ledger": {
      if (!startDate || !endDate || !accountId) {
        throw new Error(
          "startDate, endDate, and accountId are required for general-ledger",
        );
      }

      const gl = await generateGeneralLedger({
        bookId,
        accountId,
        startDate,
        endDate,
        tagIds,
        projectIds,
      });

      title = `General Ledger: ${gl.accountName}`;
      subtitle = `${startDate} to ${endDate}`;
      filenameBase = `general-ledger_${startDate}_${endDate}`;
      headers = ["Date", "Memo", "Source", "Debit", "Credit", "Balance"];

      rows = gl.entries.map((e) => [
        e.date,
        e.memo ?? "",
        e.source,
        fmt(e.debit),
        fmt(e.credit),
        fmt(e.runningBalance),
      ]);

      totals = [
        "Totals",
        "",
        "",
        fmt(gl.totalDebits),
        fmt(gl.totalCredits),
        fmt(gl.closingBalance),
      ];
      break;
    }

    case "sales-tax": {
      if (!year) {
        throw new Error("year is required for sales-tax");
      }

      const st = await generateSalesTaxReport({
        bookId,
        year: Number.parseInt(year, 10),
        jurisdictionId: jurisdictionId || undefined,
      });

      title = "Sales Tax Report";
      subtitle = `Year ${year}`;
      filenameBase = `sales-tax_${year}`;
      headers = ["Jurisdiction", "Period", "Collected", "Remitted", "Owed"];

      rows = st.jurisdictions.flatMap((j) =>
        j.periods.map((p) => [
          j.name,
          p.label,
          fmt(p.collected),
          fmt(p.remitted),
          fmt(p.owed),
        ]),
      );
      break;
    }

    case "payroll": {
      if (!year) {
        throw new Error("year is required for payroll");
      }

      const pr = await generatePayrollSummary({
        bookId,
        year: Number.parseInt(year, 10),
      });

      title = "Payroll Report";
      subtitle = `Year ${year}`;
      filenameBase = `payroll_${year}`;
      headers = [
        "Date",
        "Description",
        "Gross Wages",
        "Taxes",
        "Benefits",
        "Net Pay",
      ];

      rows = pr.payrolls.map((r) => [
        r.date,
        r.memo ?? "",
        fmt(r.grossWages),
        fmt(r.taxes),
        fmt(r.benefits),
        fmt(r.netPay),
      ]);

      totals = [
        "Totals",
        "",
        fmt(pr.totals.grossWages),
        fmt(pr.totals.taxes),
        fmt(pr.totals.benefits),
        fmt(pr.totals.netPay),
      ];
      break;
    }

    case "vendor-spend": {
      if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required for vendor-spend");
      }

      const vs = await getVendorSpend({ bookId, startDate, endDate });

      title = "Vendor Spend";
      subtitle = `${startDate} to ${endDate}`;
      filenameBase = `vendor-spend_${startDate}_${endDate}`;
      headers = ["Vendor", ...vs.months, "Total"];

      rows = vs.vendors.map((v) => [
        v.vendorName,
        ...vs.months.map((m) => fmt(v.monthly[m] ?? "0")),
        fmt(v.total),
      ]);

      totals = [
        "Totals",
        ...vs.months.map((m) => fmt(vs.monthlyTotals[m] ?? "0")),
        fmt(vs.grandTotal),
      ];
      break;
    }

    case "sales-by-state": {
      if (!year) {
        throw new Error("year is required for sales-by-state");
      }

      const sbs = await getSalesByState({
        bookId,
        year: Number.parseInt(year, 10),
      });

      title = "Sales by State";
      subtitle = `Year ${year}`;
      filenameBase = `sales-by-state_${year}`;
      headers = ["State", "Sales", "Invoices", "Meets Threshold"];

      rows = sbs.states.map((s) => [
        s.state,
        fmt(s.salesTotal),
        String(s.transactionCount),
        s.exceedsThreshold ? "Yes" : "",
      ]);

      totals = [
        "Total",
        fmt(sbs.totalSales),
        String(sbs.totalTransactions),
        "",
      ];
      break;
    }

    case "project-pnl": {
      if (!projectId) {
        throw new Error("projectId is required for project-pnl");
      }

      const ppnl = await generateProjectPnl({
        projectId,
        bookId,
        startDate,
        endDate,
      });

      title = `Project P&L: ${ppnl.project.name}`;
      subtitle =
        startDate && endDate ? `${startDate} to ${endDate}` : undefined;
      filenameBase = `project-pnl_${ppnl.project.name.replace(/\s+/g, "-")}`;
      headers = ["Account", "Type", "Amount"];

      rows = [
        ...ppnl.revenue.map((r) => {
          const net =
            Number.parseFloat(r.totalCredit) - Number.parseFloat(r.totalDebit);
          return [r.accountName, "Revenue", fmt(net.toString())];
        }),
        ...ppnl.expenses.map((e) => {
          const net =
            Number.parseFloat(e.totalDebit) - Number.parseFloat(e.totalCredit);
          return [e.accountName, "Expense", fmt(net.toString())];
        }),
      ];

      totals = ["Net Income", "", fmt(ppnl.netIncome.toString())];
      break;
    }

    default:
      throw new Error(`Unsupported report type: ${type}`);
  }

  if (format === "html") {
    return {
      content: renderReportHtml({ title, subtitle, headers, rows, totals }),
      contentType: "text/html",
      filename: `${filenameBase}.html`,
    };
  }

  if (format === "xlsx") {
    return {
      content: await renderReportXlsx({
        title,
        subtitle,
        headers,
        rows,
        totals,
      }),
      contentType: XLSX_CONTENT_TYPE,
      filename: `${filenameBase}.xlsx`,
    };
  }

  if (format === "pdf") {
    return {
      content: await renderReportPdf({
        title,
        subtitle,
        headers,
        rows,
        totals,
      }),
      contentType: "application/pdf",
      filename: `${filenameBase}.pdf`,
    };
  }

  // CSV
  const csvRows = totals ? [...rows, totals] : rows;

  return {
    content: renderCsv(headers, csvRows),
    contentType: "text/csv",
    filename: `${filenameBase}.csv`,
  };
};

export default exportReport;
