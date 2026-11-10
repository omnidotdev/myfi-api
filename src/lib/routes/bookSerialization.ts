import { decryptToken } from "lib/encryption/tokenEncryption";

/** Mask a stored (encrypted) filer EIN to its last four digits for display. */
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
 * Shape a book row for the API: never return the encrypted EIN, only a masked
 * hint so the owner can confirm what is on file. Every other column passes
 * through unchanged, including invoiceSource, which the app reads to gate
 * native invoice/quote/inventory authoring when Mantle owns the book
 */
export const toPublicBook = <T extends { ein: string | null }>(book: T) => {
  const { ein, ...rest } = book;
  return { ...rest, einMasked: maskEin(ein) };
};
