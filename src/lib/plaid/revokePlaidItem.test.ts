import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockItemRemove = mock(async () => ({}));
mock.module("./plaidClient", () => ({
  default: { itemRemove: mockItemRemove },
}));
mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: (t: string) => `decrypted:${t}`,
}));

const { revokePlaidItem } = await import("./revokePlaidItem");

describe("revokePlaidItem", () => {
  beforeEach(() => {
    mockItemRemove.mockClear();
    mockItemRemove.mockImplementation(async () => ({}));
  });

  test("decrypts the token and asks Plaid to remove the item", async () => {
    const ok = await revokePlaidItem("enc-token");
    expect(ok).toBe(true);
    expect(mockItemRemove).toHaveBeenCalledWith({
      access_token: "decrypted:enc-token",
    });
  });

  test("returns false without throwing when Plaid rejects (best effort)", async () => {
    mockItemRemove.mockImplementation(async () => {
      throw new Error("ITEM_NOT_FOUND");
    });
    const ok = await revokePlaidItem("enc-token");
    expect(ok).toBe(false);
  });
});
