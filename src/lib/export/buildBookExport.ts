import { eq, inArray } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import {
  accountMappingTable,
  accountTable,
  accountingPeriodTable,
  amortizationEntryTable,
  attachmentTable,
  billLineTable,
  billPaymentTable,
  billTable,
  bookTable,
  budgetTable,
  connectedAccountTable,
  customerTable,
  estimateLineTable,
  estimateTable,
  fixedAssetTable,
  inventoryItemTable,
  inventoryTransactionTable,
  invoiceLineTable,
  invoicePaymentTable,
  invoiceTable,
  journalEntryTable,
  journalLineProjectTable,
  journalLineTable,
  journalLineTagTable,
  loanTable,
  projectTable,
  reconciliationStatementTable,
  recurringTransactionTable,
  tagGroupTable,
  tagTable,
  taxJurisdictionTable,
  vendorTable,
} from "lib/db/schema";
import { decryptToken } from "lib/encryption/tokenEncryption";

/** Current schema version of the export document */
const EXPORT_VERSION = 1;

/**
 * Mask an encrypted tax id down to its last four digits for display, matching
 * the shape vendorRoutes already returns. Never surfaces the raw identifier
 */
const maskTin = (
  encryptedTin: string | null,
  type: string | null,
): string | null => {
  if (!encryptedTin) return null;
  try {
    const last4 = decryptToken(encryptedTin).slice(-4);
    if (type === "ssn") return `***-**-${last4}`;
    if (type === "ein") return `**-***${last4}`;
    return `****${last4}`;
  } catch {
    return "****";
  }
};

/** Mask an encrypted filer EIN to its last four digits, like bookRoutes does */
const maskEin = (encrypted: string | null): string | null => {
  if (!encrypted) return null;
  try {
    const last4 = decryptToken(encrypted).replace(/\D/g, "").slice(-4);
    return last4 ? `**-***${last4}` : null;
  } catch {
    return null;
  }
};

/**
 * Query rows by a parent-id list, short-circuiting to an empty array when the
 * list is empty so an empty `inArray` never reaches the database
 */
const childrenOf = async <T>(
  ids: string[],
  run: (ids: string[]) => Promise<T[]>,
): Promise<T[]> => (ids.length ? run(ids) : []);

/**
 * Build a complete, portable export of a single book's data as a plain
 * JSON-serializable object. Every book-scoped table is included so the owner
 * can back up, migrate, or leave with their full dataset.
 *
 * Secrets are never included: encrypted tax ids are reduced to a masked hint,
 * connected-account access tokens / provider item ids / sync cursors are
 * omitted entirely, and stored-file keys (the private object-storage paths) are
 * dropped from attachment metadata. See the per-table selects below
 *
 * @param bookId - Book to export
 * @returns The export document, or null when the book does not exist
 */
export const buildBookExport = async (bookId: string) => {
  const [book] = await dbPool
    .select()
    .from(bookTable)
    .where(eq(bookTable.id, bookId));

  if (!book) return null;

  // Strip the encrypted EIN; expose only a masked hint
  const { ein, ...bookRest } = book;

  const [
    accounts,
    journalEntries,
    customers,
    vendorRows,
    invoices,
    invoicePayments,
    bills,
    billPayments,
    estimates,
    inventoryItems,
    inventoryTransactions,
    taxJurisdictions,
    fixedAssets,
    loans,
    budgets,
    projects,
    tagGroups,
    recurringTransactions,
    reconciliationStatements,
    accountingPeriods,
    accountMappings,
  ] = await Promise.all([
    dbPool.select().from(accountTable).where(eq(accountTable.bookId, bookId)),
    dbPool
      .select()
      .from(journalEntryTable)
      .where(eq(journalEntryTable.bookId, bookId)),
    dbPool.select().from(customerTable).where(eq(customerTable.bookId, bookId)),
    dbPool.select().from(vendorTable).where(eq(vendorTable.bookId, bookId)),
    dbPool.select().from(invoiceTable).where(eq(invoiceTable.bookId, bookId)),
    dbPool
      .select()
      .from(invoicePaymentTable)
      .where(eq(invoicePaymentTable.bookId, bookId)),
    dbPool.select().from(billTable).where(eq(billTable.bookId, bookId)),
    dbPool
      .select()
      .from(billPaymentTable)
      .where(eq(billPaymentTable.bookId, bookId)),
    dbPool.select().from(estimateTable).where(eq(estimateTable.bookId, bookId)),
    dbPool
      .select()
      .from(inventoryItemTable)
      .where(eq(inventoryItemTable.bookId, bookId)),
    dbPool
      .select()
      .from(inventoryTransactionTable)
      .where(eq(inventoryTransactionTable.bookId, bookId)),
    dbPool
      .select()
      .from(taxJurisdictionTable)
      .where(eq(taxJurisdictionTable.bookId, bookId)),
    dbPool
      .select()
      .from(fixedAssetTable)
      .where(eq(fixedAssetTable.bookId, bookId)),
    dbPool.select().from(loanTable).where(eq(loanTable.bookId, bookId)),
    dbPool.select().from(budgetTable).where(eq(budgetTable.bookId, bookId)),
    dbPool.select().from(projectTable).where(eq(projectTable.bookId, bookId)),
    dbPool.select().from(tagGroupTable).where(eq(tagGroupTable.bookId, bookId)),
    dbPool
      .select()
      .from(recurringTransactionTable)
      .where(eq(recurringTransactionTable.bookId, bookId)),
    dbPool
      .select()
      .from(reconciliationStatementTable)
      .where(eq(reconciliationStatementTable.bookId, bookId)),
    dbPool
      .select()
      .from(accountingPeriodTable)
      .where(eq(accountingPeriodTable.bookId, bookId)),
    dbPool
      .select()
      .from(accountMappingTable)
      .where(eq(accountMappingTable.bookId, bookId)),
  ]);

  const journalEntryIds = journalEntries.map((e) => e.id);
  const invoiceIds = invoices.map((i) => i.id);
  const billIds = bills.map((b) => b.id);
  const estimateIds = estimates.map((e) => e.id);
  const loanIds = loans.map((l) => l.id);
  const tagGroupIds = tagGroups.map((g) => g.id);

  const journalLines = await childrenOf(journalEntryIds, (ids) =>
    dbPool
      .select()
      .from(journalLineTable)
      .where(inArray(journalLineTable.journalEntryId, ids)),
  );
  const journalLineIds = journalLines.map((l) => l.id);

  const [
    journalLineTags,
    journalLineProjects,
    invoiceLines,
    billLines,
    estimateLines,
    amortizationEntries,
    tags,
    // Attachment metadata only: the storage key (private object-storage path)
    // and the binary blob itself are deliberately excluded
    attachments,
    // Connected accounts without any secret material: accessToken,
    // providerAccountId (provider item id), and syncCursor are omitted
    connectedAccounts,
  ] = await Promise.all([
    childrenOf(journalLineIds, (ids) =>
      dbPool
        .select()
        .from(journalLineTagTable)
        .where(inArray(journalLineTagTable.journalLineId, ids)),
    ),
    childrenOf(journalLineIds, (ids) =>
      dbPool
        .select()
        .from(journalLineProjectTable)
        .where(inArray(journalLineProjectTable.journalLineId, ids)),
    ),
    childrenOf(invoiceIds, (ids) =>
      dbPool
        .select()
        .from(invoiceLineTable)
        .where(inArray(invoiceLineTable.invoiceId, ids)),
    ),
    childrenOf(billIds, (ids) =>
      dbPool
        .select()
        .from(billLineTable)
        .where(inArray(billLineTable.billId, ids)),
    ),
    childrenOf(estimateIds, (ids) =>
      dbPool
        .select()
        .from(estimateLineTable)
        .where(inArray(estimateLineTable.estimateId, ids)),
    ),
    childrenOf(loanIds, (ids) =>
      dbPool
        .select()
        .from(amortizationEntryTable)
        .where(inArray(amortizationEntryTable.loanId, ids)),
    ),
    childrenOf(tagGroupIds, (ids) =>
      dbPool.select().from(tagTable).where(inArray(tagTable.tagGroupId, ids)),
    ),
    dbPool
      .select({
        id: attachmentTable.id,
        bookId: attachmentTable.bookId,
        journalEntryId: attachmentTable.journalEntryId,
        filename: attachmentTable.filename,
        contentType: attachmentTable.contentType,
        sizeBytes: attachmentTable.sizeBytes,
        uploadStatus: attachmentTable.uploadStatus,
        createdBy: attachmentTable.createdBy,
        createdAt: attachmentTable.createdAt,
      })
      .from(attachmentTable)
      .where(eq(attachmentTable.bookId, bookId)),
    dbPool
      .select({
        id: connectedAccountTable.id,
        bookId: connectedAccountTable.bookId,
        provider: connectedAccountTable.provider,
        accountId: connectedAccountTable.accountId,
        institutionName: connectedAccountTable.institutionName,
        mask: connectedAccountTable.mask,
        status: connectedAccountTable.status,
        lastSyncedAt: connectedAccountTable.lastSyncedAt,
        createdAt: connectedAccountTable.createdAt,
      })
      .from(connectedAccountTable)
      .where(eq(connectedAccountTable.bookId, bookId)),
  ]);

  // Replace each vendor's encrypted tax id with a masked hint
  const vendors = vendorRows.map(({ taxId, ...rest }) => ({
    ...rest,
    taxIdMasked: maskTin(taxId, rest.taxIdType),
  }));

  return {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    book: { ...bookRest, einMasked: maskEin(ein) },
    accounts,
    journalEntries,
    journalLines,
    journalLineTags,
    journalLineProjects,
    customers,
    vendors,
    invoices,
    invoiceLines,
    invoicePayments,
    bills,
    billLines,
    billPayments,
    estimates,
    estimateLines,
    inventoryItems,
    inventoryTransactions,
    taxJurisdictions,
    fixedAssets,
    loans,
    amortizationEntries,
    budgets,
    projects,
    tagGroups,
    tags,
    recurringTransactions,
    reconciliationStatements,
    accountingPeriods,
    attachments,
    accountMappings,
    connectedAccounts,
  };
};

/**
 * Build a safe download filename from a book name and an ISO timestamp:
 * a lowercase slug of the name plus the date, e.g. `acme-co-2026-10-28.json`
 */
export const bookExportFilename = (
  bookName: string,
  isoDate: string,
): string => {
  const slug =
    bookName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "book";
  const date = isoDate.slice(0, 10);
  return `${slug}-${date}.json`;
};
