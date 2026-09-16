import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { bookTable } from "lib/db/schema";

type InvoiceSource = "myfi" | "mantle";

/**
 * A book's source of record for invoices, quotes, and inventory. "myfi" means
 * MyFi's native front-office owns them (standalone use); "mantle" means Mantle
 * owns them and MyFi only records the accounting from Mantle CloudEvents. This
 * is the single-SSOT boundary: exactly one side posts for a given book.
 *
 * The source is not configured by hand: a book stays "myfi" until MyFi receives
 * its first Mantle event for it, at which point the consumer auto-adopts
 * "mantle" (see adoptMantleSource). A book may still be pinned explicitly
 */
export const getBookInvoiceSource = async (
  bookId: string,
): Promise<InvoiceSource> => {
  const [book] = await dbPool
    .select({ invoiceSource: bookTable.invoiceSource })
    .from(bookTable)
    .where(eq(bookTable.id, bookId));
  return book?.invoiceSource === "mantle" ? "mantle" : "myfi";
};

/**
 * Whether the book's front-office is managed in Mantle. Native invoice/estimate/
 * inventory mutations are refused for such books so Mantle stays the sole source
 */
export const isMantleManaged = async (bookId: string): Promise<boolean> =>
  (await getBookInvoiceSource(bookId)) === "mantle";

/**
 * Auto-adopt Mantle as a book's source of record. Called when a Mantle event is
 * first received for the book, so no manual setup is needed. Returns true when
 * it actually flipped a "myfi" book to "mantle" (so the caller can surface the
 * change), false when it was already Mantle-managed
 */
export const adoptMantleSource = async (bookId: string): Promise<boolean> => {
  const result = await dbPool
    .update(bookTable)
    .set({ invoiceSource: "mantle", updatedAt: new Date().toISOString() })
    .where(and(eq(bookTable.id, bookId), eq(bookTable.invoiceSource, "myfi")))
    .returning({ id: bookTable.id });
  return result.length > 0;
};

/** Error message surfaced when a native mutation is blocked by Mantle ownership */
export const MANTLE_MANAGED_MESSAGE =
  "This book's invoices, quotes, and inventory are managed in Mantle";
