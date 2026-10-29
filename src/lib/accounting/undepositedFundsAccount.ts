import { and, eq } from "drizzle-orm";

// biome-ignore lint/style/useImportType: dbPool is used in a typeof query below, which needs a value import (import type breaks tsc)
import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

/** A Drizzle transaction handle (the argument the transaction callback receives) */
type Tx = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

/**
 * Resolve the book's Undeposited Funds account, creating it the first time a
 * receipt is held for deposit. This current asset holds customer payments that
 * have been received but not yet deposited, so a later bank deposit can group
 * several of them into one bank line matching a real deposit slip
 */
export const resolveUndepositedFundsAccount = async (
  tx: Tx,
  bookId: string,
): Promise<string> => {
  const [existing] = await tx
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, "undeposited_funds"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(accountTable)
    .values({
      bookId,
      name: "Undeposited Funds",
      type: "asset",
      subType: "undeposited_funds",
    })
    .returning({ id: accountTable.id });
  if (!created) {
    throw new Error("Failed to create the Undeposited Funds account");
  }
  return created.id;
};
