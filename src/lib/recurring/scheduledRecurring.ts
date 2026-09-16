import { runDueRecurring } from "./materializeRecurring";

/**
 * Start the recurring-transaction scheduler: once a day, post every active
 * recurring transaction that has come due (across all books). Idempotent per
 * occurrence, so a missed day is caught up on the next run
 */
const startScheduledRecurring = () => {
  const checkInterval = 24 * 60 * 60 * 1000; // 24 hours

  const run = async () => {
    const asOf = new Date().toISOString().slice(0, 10);
    try {
      const results = await runDueRecurring({ asOf });
      const posted = results.reduce((sum, r) => sum + r.posted, 0);
      if (posted > 0) {
        console.info(
          `[ScheduledRecurring] Posted ${posted} recurring entries across ${results.length} schedules`,
        );
      }
    } catch (err) {
      console.error("[ScheduledRecurring] Failed:", err);
    }
  };

  const interval = setInterval(run, checkInterval);
  return () => clearInterval(interval);
};

export default startScheduledRecurring;
