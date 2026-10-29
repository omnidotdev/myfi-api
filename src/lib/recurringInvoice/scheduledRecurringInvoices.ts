import { materializeRecurringInvoices } from "./materializeRecurringInvoices";

/**
 * Start the recurring-invoice scheduler: once a day, generate a draft invoice
 * for every active template that has come due (across all books), catching up
 * any missed occurrences. The drafts are not posted; a user posts them through
 * the normal invoice flow. A missed day is caught up on the next run
 */
const startScheduledRecurringInvoices = () => {
  const checkInterval = 24 * 60 * 60 * 1000; // 24 hours

  const run = async () => {
    const asOf = new Date().toISOString().slice(0, 10);
    try {
      const { generated, perTemplate } = await materializeRecurringInvoices({
        asOf,
      });
      if (generated > 0) {
        console.info(
          `[ScheduledRecurringInvoices] Generated ${generated} draft invoices across ${perTemplate.length} templates`,
        );
      }
    } catch (err) {
      console.error("[ScheduledRecurringInvoices] Failed:", err);
    }
  };

  const interval = setInterval(run, checkInterval);
  return () => clearInterval(interval);
};

export default startScheduledRecurringInvoices;
