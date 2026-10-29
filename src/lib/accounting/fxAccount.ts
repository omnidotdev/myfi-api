import { and, eq } from "drizzle-orm";

// biome-ignore lint/style/useImportType: dbPool is used in a typeof query below, which needs a value import (import type breaks tsc)
import { dbPool } from "lib/db/db";
import { accountTable } from "lib/db/schema";

/** A Drizzle transaction handle (the argument the transaction callback receives) */
type Tx = Parameters<Parameters<typeof dbPool.transaction>[0]>[0];

/**
 * Resolve the book's foreign-exchange gain/loss account, creating it the first
 * time a realized FX difference needs to post. One account carries both gains
 * (credits) and losses (debits), matching how accounting software nets FX
 */
export const resolveFxAccount = async (
  tx: Tx,
  bookId: string,
): Promise<string> => {
  const [existing] = await tx
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.bookId, bookId),
        eq(accountTable.subType, "fx_gain_loss"),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(accountTable)
    .values({
      bookId,
      name: "Foreign Exchange Gain/Loss",
      type: "expense",
      subType: "fx_gain_loss",
    })
    .returning({ id: accountTable.id });
  if (!created) {
    throw new Error("Failed to create the FX gain/loss account");
  }
  return created.id;
};
