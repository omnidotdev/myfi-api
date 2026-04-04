import runMonthlyClose from "./monthlyClose";

/**
 * Start the monthly close scheduler.
 * Checks daily whether it is the 5th of the month,
 * and if so, attempts to close the prior month for all books
 */
const startScheduledClose = () => {
  const checkInterval = 24 * 60 * 60 * 1000; // 24 hours

  const maybeClose = async () => {
    const now = new Date();

    if (now.getUTCDate() !== 5) return;

    console.info("[ScheduledClose] Running monthly close...");

    try {
      const results = await runMonthlyClose();
      const closed = results.filter((r) => r.status === "closed").length;
      const blocked = results.filter((r) => r.status === "blocked").length;
      console.info(
        `[ScheduledClose] Complete: ${closed} closed, ${blocked} blocked`,
      );

      for (const r of results) {
        if (r.status === "blocked") {
          console.warn(
            `[ScheduledClose] ${r.bookName} blocked: ${r.blockers?.pendingReviewCount} pending items`,
          );
        }
      }
    } catch (err) {
      console.error("[ScheduledClose] Failed:", err);
    }
  };

  const interval = setInterval(maybeClose, checkInterval);

  return () => clearInterval(interval);
};

export default startScheduledClose;
