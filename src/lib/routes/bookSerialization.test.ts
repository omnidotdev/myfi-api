import { describe, expect, mock, test } from "bun:test";

// toPublicBook masks the EIN through decryptToken; stub it so this unit test
// needs no encryption key and no real ciphertext
mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: () => "12-3456789",
  encryptToken: (value: string) => value,
}));

const { toPublicBook } = await import("./bookSerialization");

describe("toPublicBook", () => {
  // Guards the fragile link behind MyFi's Mantle-managed gating: the client
  // reads invoiceSource off /api/books to disable native invoice/quote/
  // inventory authoring. If the serializer ever drops the field, the gating
  // silently goes dead (every book reads as native)
  test("preserves invoiceSource so the client can gate native authoring", () => {
    const pub = toPublicBook({
      id: "book-1",
      name: "Acme",
      invoiceSource: "mantle",
      ein: null,
    });
    expect(pub.invoiceSource).toBe("mantle");
  });

  test("never returns the raw ein, only a masked hint", () => {
    const pub = toPublicBook({
      id: "book-1",
      name: "Acme",
      invoiceSource: "myfi",
      ein: "encrypted-ciphertext",
    });
    expect(pub).not.toHaveProperty("ein");
    expect(pub.einMasked).toBe("**-***6789");
  });
});
