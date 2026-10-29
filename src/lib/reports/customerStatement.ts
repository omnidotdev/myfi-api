import { and, eq, inArray, lte } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { creditMemoTable, customerTable, invoiceTable } from "lib/db/schema";

interface StatementLine {
  invoiceId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  balance: string;
}

interface CustomerStatement {
  bookId: string;
  customerId: string;
  customerName: string;
  asOfDate: string;
  lines: StatementLine[];
  /** Sum of open invoice balances, converted to home currency at booked rate */
  totalOutstanding: string;
  /** Unapplied customer credit (open credit memos) in home currency */
  unappliedCredit: string;
  /** Outstanding less unapplied credit, floored at zero */
  balanceDue: string;
  generatedAt: string;
}

/**
 * An open-item customer statement: the customer's unpaid and partially paid
 * invoices as of a date with their outstanding balance, the available unapplied
 * credit, and the net amount due. Amounts are in the book's home currency
 * (foreign invoices converted at their booked rate)
 */
const generateCustomerStatement = async (params: {
  bookId: string;
  customerId: string;
  asOfDate: string;
}): Promise<CustomerStatement> => {
  const { bookId, customerId, asOfDate } = params;

  const [customer] = await dbPool
    .select({ name: customerTable.name })
    .from(customerTable)
    .where(and(eq(customerTable.id, customerId), eq(customerTable.bookId, bookId)));
  if (!customer) {
    throw new Error("Customer not found for this book");
  }

  const invoices = await dbPool
    .select({
      invoiceId: invoiceTable.id,
      number: invoiceTable.number,
      issueDate: invoiceTable.issueDate,
      dueDate: invoiceTable.dueDate,
      total: invoiceTable.total,
      amountPaid: invoiceTable.amountPaid,
      exchangeRate: invoiceTable.exchangeRate,
    })
    .from(invoiceTable)
    .where(
      and(
        eq(invoiceTable.bookId, bookId),
        eq(invoiceTable.customerId, customerId),
        inArray(invoiceTable.status, ["open", "partial"]),
        lte(invoiceTable.issueDate, asOfDate),
      ),
    );

  const lines: StatementLine[] = [];
  let outstanding = 0;
  for (const inv of invoices) {
    const rate = Number.parseFloat(inv.exchangeRate as string) || 1;
    const balance =
      ((Number.parseFloat(inv.total) || 0) -
        (Number.parseFloat(inv.amountPaid) || 0)) *
      rate;
    if (balance <= 0.00005) continue;
    outstanding += balance;
    lines.push({
      invoiceId: inv.invoiceId,
      number: inv.number,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balance: balance.toFixed(4),
    });
  }

  const creditMemos = await dbPool
    .select({
      total: creditMemoTable.total,
      amountApplied: creditMemoTable.amountApplied,
      exchangeRate: creditMemoTable.exchangeRate,
    })
    .from(creditMemoTable)
    .where(
      and(
        eq(creditMemoTable.bookId, bookId),
        eq(creditMemoTable.customerId, customerId),
        eq(creditMemoTable.status, "open"),
      ),
    );
  let unapplied = 0;
  for (const cm of creditMemos) {
    const rate = Number.parseFloat(cm.exchangeRate as string) || 1;
    unapplied +=
      ((Number.parseFloat(cm.total) || 0) -
        (Number.parseFloat(cm.amountApplied) || 0)) *
      rate;
  }

  return {
    bookId,
    customerId,
    customerName: customer.name,
    asOfDate,
    lines,
    totalOutstanding: outstanding.toFixed(4),
    unappliedCredit: unapplied.toFixed(4),
    balanceDue: Math.max(0, outstanding - unapplied).toFixed(4),
    generatedAt: new Date().toISOString(),
  };
};

export default generateCustomerStatement;
