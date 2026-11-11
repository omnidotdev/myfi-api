import { describe, expect, test } from "bun:test";
import { createCipheriv, randomBytes } from "node:crypto";

// The module reads TOKEN_ENCRYPTION_KEY from env at load; set it before the
// dynamic import below so the real key buffer is derived from a known value
const KEY_HEX =
  "00000000000000000000000000000000000000000000000000000000000000ff";
process.env.TOKEN_ENCRYPTION_KEY = KEY_HEX;

const { encryptToken, decryptToken } = await import("./tokenEncryption");

/**
 * Encrypt with an arbitrary key, reproducing the module's `iv:tag:ciphertext`
 * wire format, so a token sealed under a different key can be fed to
 * decryptToken to assert it is rejected.
 */
const encryptWithKey = (plaintext: string, keyHex: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

describe("tokenEncryption", () => {
  test("round-trips a plaintext value", () => {
    const secret = "access-sandbox-abc123";

    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  test("round-trips unicode and empty strings", () => {
    expect(decryptToken(encryptToken(""))).toBe("");
    expect(decryptToken(encryptToken("café ☕ 日本"))).toBe("café ☕ 日本");
  });

  test("produces a fresh IV each call (ciphertext is non-deterministic)", () => {
    const a = encryptToken("same-value");
    const b = encryptToken("same-value");

    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-value");
    expect(decryptToken(b)).toBe("same-value");
  });

  test("rejects a tampered ciphertext (GCM auth tag fails)", () => {
    const token = encryptToken("do-not-tamper");
    const [iv, tag, ciphertext] = token.split(":");
    // Flip the last hex nibble of the ciphertext
    const lastChar = ciphertext.slice(-1);
    const flipped = lastChar === "0" ? "1" : "0";
    const tampered = `${iv}:${tag}:${ciphertext.slice(0, -1)}${flipped}`;

    expect(() => decryptToken(tampered)).toThrow();
  });

  test("rejects garbage and malformed input", () => {
    expect(() => decryptToken("garbage")).toThrow(
      /Invalid encrypted token format/,
    );
    expect(() => decryptToken("a:b")).toThrow(/Invalid encrypted token format/);
    expect(() => decryptToken("zz:zz:zz")).toThrow();
  });

  test("rejects a token sealed under a different key", () => {
    const foreign = encryptWithKey("secret", "1".repeat(64));

    expect(() => decryptToken(foreign)).toThrow();
  });
});
