import { recordBillPayment } from "./recordBillPayment";

interface BatchItem {
  billId: string;
  amount: number;
}

interface PayBillsBatchResult {
  results: {
    billId: string;
    paymentId: string;
    billStatus: "partial" | "paid";
    amountPaid: number;
  }[];
  totalPaid: number;
}

/**
 * Pay several bills from one account in a single action (QuickBooks "Pay Bills").
 * Each bill is paid through the per-bill payment path, so every bill gets its own
 * payment row and balanced journal entry (including any FX gain/loss), the same
 * as paying it individually. Payments are applied in order; a failure on one
 * bill (e.g. overpayment) aborts the batch and propagates, so a bad line never
 * silently pays only some bills
 */
export const payBillsBatch = async (params: {
  bookId: string;
  paymentAccountId: string;
  date: string;
  payments: BatchItem[];
}): Promise<PayBillsBatchResult> => {
  const { bookId, paymentAccountId, date, payments } = params;

  if (payments.length === 0) {
    throw new Error("A batch needs at least one bill to pay");
  }
  const billIds = new Set<string>();
  for (const p of payments) {
    if (billIds.has(p.billId)) {
      throw new Error("A bill appears more than once in the batch");
    }
    billIds.add(p.billId);
  }

  const results: PayBillsBatchResult["results"] = [];
  let totalPaid = 0;
  for (const payment of payments) {
    const result = await recordBillPayment({
      billId: payment.billId,
      bookId,
      amount: payment.amount,
      paymentAccountId,
      date,
    });
    results.push({
      billId: payment.billId,
      paymentId: result.paymentId,
      billStatus: result.billStatus,
      amountPaid: result.amountPaid,
    });
    totalPaid += payment.amount;
  }

  return { results, totalPaid };
};
