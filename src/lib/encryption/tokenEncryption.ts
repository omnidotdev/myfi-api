import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { TOKEN_ENCRYPTION_KEY } from "lib/config/env.config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Derive the raw key buffer from the hex-encoded environment variable.
 * Throws if the key is missing or malformed.
 */
const getKeyBuffer = () => {
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  const buf = Buffer.from(TOKEN_ENCRYPTION_KEY, "hex");

  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) key");
  }

  return buf;
};

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * @param plaintext - Value to encrypt.
 * @returns Colon-delimited `iv:tag:ciphertext` hex string.
 */
const encryptToken = (plaintext: string): string => {
  const key = getKeyBuffer();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

/**
 * Decrypt an AES-256-GCM encrypted token.
 * @param encrypted - Colon-delimited `iv:tag:ciphertext` hex string.
 * @returns Decrypted plaintext.
 */
const decryptToken = (encrypted: string): string => {
  const key = getKeyBuffer();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

export { decryptToken, encryptToken };
