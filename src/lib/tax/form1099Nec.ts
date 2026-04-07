import { and, eq, gte, lt, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountTable,
  journalEntryTable,
  journalLineTable,
  vendorTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";

type RecipientAddress = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type Form1099NecRecord = {
  vendorId: string;
  recipientName: string;
  recipientTin: string | null;
  recipientTinType: string | null;
  recipientAddress: RecipientAddress;
  box1NonemployeeCompensation: string;
};

type Form1099NecReport = {
  year: number;
  forms: Form1099NecRecord[];
  totalForms: number;
  totalAmount: string;
  generatedAt: string;
};

const DEFAULT_THRESHOLD = 600;

/**
 * Generate 1099-NEC forms for all qualifying vendors in a given tax year.
 * Vendors qualify when their total expense-account debits meet or exceed
 * the per-vendor threshold (default $600)
 * @param params - Book ID and tax year
 * @returns Report containing 1099-NEC form records for qualifying vendors
 */
const generate1099Nec = async (params: {
  bookId: string;
  year: number;
}): Promise<Form1099NecReport> => {
  const { bookId, year } = params;
  const nextYear = year + 1;
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${nextYear}-01-01T00:00:00.000Z`;

  // Fetch all 1099-eligible vendors for this book
  const vendors = await dbPool
    .select()
    .from(vendorTable)
    .where(
      and(eq(vendorTable.bookId, bookId), eq(vendorTable.is1099Eligible, true)),
    );

  const forms: Form1099NecRecord[] = [];
  let totalAmount = 0;

  for (const vendor of vendors) {
    // Sum expense debits for this vendor in the tax year
    const [result] = await dbPool
      .select({
        total: sql<string>`coalesce(sum(${journalLineTable.debit}), 0)`,
      })
      .from(journalLineTable)
      .innerJoin(
        journalEntryTable,
        eq(journalLineTable.journalEntryId, journalEntryTable.id),
      )
      .innerJoin(accountTable, eq(journalLineTable.accountId, accountTable.id))
      .where(
        and(
          eq(journalEntryTable.vendorId, vendor.id),
          gte(journalEntryTable.date, startDate),
          lt(journalEntryTable.date, endDate),
          eq(accountTable.type, "expense"),
        ),
      );

    const total = Number.parseFloat(result?.total ?? "0");
    const threshold = vendor.threshold
      ? Number.parseFloat(vendor.threshold)
      : DEFAULT_THRESHOLD;

    if (total < threshold) continue;

    // Decrypt TIN if present
    let recipientTin: string | null = null;

    if (vendor.taxId) {
      try {
        recipientTin = decryptToken(vendor.taxId);
      } catch {
        // TIN decryption failed, mark as missing
        recipientTin = null;
      }
    }

    forms.push({
      vendorId: vendor.id,
      recipientName: vendor.businessName ?? vendor.name,
      recipientTin,
      recipientTinType: vendor.taxIdType,
      recipientAddress: {
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        zip: vendor.zip,
      },
      box1NonemployeeCompensation: total.toFixed(2),
    });

    totalAmount += total;
  }

  return {
    year,
    forms,
    totalForms: forms.length,
    totalAmount: totalAmount.toFixed(2),
    generatedAt: new Date().toISOString(),
  };
};

export default generate1099Nec;
