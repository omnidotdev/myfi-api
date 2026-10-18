import { and, asc, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { accountMappingTable, accountTable } from "lib/db/schema";

interface MappingDef {
  eventType: string;
  // Ordered subType preferences; the first that resolves for the book is used
  debit: string[];
  credit: string[];
}

/**
 * Default Mantle accounting-event to account mappings. Debit/credit are ordered
 * subType preferences resolved against the book's standard chart of accounts.
 * The directions encode the standard treatment: receivable recognized on send,
 * cash on payment (reversed on delete), and customer credit as a liability that
 * is created on overpayment and drawn down when applied.
 */
const DEFAULT_MANTLE_MAPPINGS: MappingDef[] = [
  {
    eventType: "invoice.sent",
    debit: ["accounts_receivable"],
    credit: ["sales", "service_revenue"],
  },
  {
    eventType: "payment.received",
    debit: ["cash", "bank"],
    credit: ["accounts_receivable"],
  },
  {
    eventType: "payment.reversed",
    debit: ["accounts_receivable"],
    credit: ["cash", "bank"],
  },
  {
    eventType: "credit.issued",
    debit: ["accounts_receivable"],
    credit: ["customer_credit"],
  },
  {
    eventType: "credit.applied",
    debit: ["customer_credit"],
    credit: ["accounts_receivable"],
  },
];

interface SeededMapping {
  bookId: string;
  eventType: string;
  debitAccountId: string;
  creditAccountId: string;
}

/**
 * Create the default Mantle account mappings for a book, resolving standard
 * accounts by subType (the same resolution the native posting paths use). A
 * mapping is created only when both its debit and credit accounts resolve AND no
 * mapping already exists for that event type, so this is additive and safe to
 * run repeatedly: a book with no seeded chart of accounts gets nothing, and an
 * existing (possibly hand-tuned) mapping is never overwritten.
 */
export const seedDefaultMantleMappings = async (
  bookId: string,
): Promise<SeededMapping[]> => {
  const accounts = await dbPool
    .select({ id: accountTable.id, subType: accountTable.subType })
    .from(accountTable)
    .where(
      and(eq(accountTable.bookId, bookId), eq(accountTable.isActive, true)),
    )
    .orderBy(asc(accountTable.createdAt));

  // First active account per subType, deterministic by createdAt
  const bySubType = new Map<string, string>();
  for (const account of accounts) {
    if (account.subType && !bySubType.has(account.subType)) {
      bySubType.set(account.subType, account.id);
    }
  }

  const resolve = (subTypes: string[]): string | undefined => {
    for (const subType of subTypes) {
      const id = bySubType.get(subType);
      if (id) return id;
    }
    return undefined;
  };

  const existing = await dbPool
    .select({ eventType: accountMappingTable.eventType })
    .from(accountMappingTable)
    .where(eq(accountMappingTable.bookId, bookId));
  const existingEvents = new Set(existing.map((row) => row.eventType));

  const toCreate: SeededMapping[] = [];
  for (const def of DEFAULT_MANTLE_MAPPINGS) {
    if (existingEvents.has(def.eventType)) continue;

    const debitAccountId = resolve(def.debit);
    const creditAccountId = resolve(def.credit);
    if (!debitAccountId || !creditAccountId) continue;

    toCreate.push({
      bookId,
      eventType: def.eventType,
      debitAccountId,
      creditAccountId,
    });
  }

  if (toCreate.length > 0) {
    await dbPool.insert(accountMappingTable).values(toCreate);
  }

  return toCreate;
};
