import { eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { estimateTable } from "lib/db/schema";

/** Statuses a user can set directly (converted is set only by conversion) */
export type SettableEstimateStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "expired";

const SETTABLE: SettableEstimateStatus[] = [
  "sent",
  "accepted",
  "declined",
  "expired",
];

interface UpdateEstimateStatusResult {
  estimateId: string;
  status: SettableEstimateStatus;
}

/**
 * Transition an estimate's status (send, accept, decline, expire). A converted
 * estimate is locked, since its invoice already exists. Book-ownership guarded
 */
export const updateEstimateStatus = async (
  estimateId: string,
  bookId: string,
  status: SettableEstimateStatus,
): Promise<UpdateEstimateStatusResult> => {
  if (!SETTABLE.includes(status)) {
    throw new Error("Invalid estimate status");
  }

  const [estimate] = await dbPool
    .select()
    .from(estimateTable)
    .where(eq(estimateTable.id, estimateId));

  if (!estimate) {
    throw new Error("Estimate not found");
  }
  if (estimate.bookId !== bookId) {
    throw new Error("Estimate not found");
  }
  if (estimate.status === "converted") {
    throw new Error("A converted estimate cannot change status");
  }

  await dbPool
    .update(estimateTable)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(estimateTable.id, estimateId));

  return { estimateId, status };
};
