import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { TOKEN_ENCRYPTION_KEY } from "lib/config/env.config";

/**
 * How long a signed OAuth state stays valid, in milliseconds. Short by design:
 * the state only needs to survive one redirect round-trip through the provider
 */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Domain-separation label mixed into the HMAC key so the OAuth-state signing key
 * is distinct from the token-encryption key, even though both derive from the
 * same TOKEN_ENCRYPTION_KEY secret
 */
const HMAC_KEY_LABEL = "myfi:oauth:state:v1";

type StatePayload = {
  bookId: string;
  nonce: string;
  exp: number;
  /** Same-origin app path to land on after the OAuth round-trip, if provided */
  returnPath?: string;
};

/**
 * A return path is safe only if it is a same-origin absolute path: it must start
 * with a single "/", never "//" (protocol-relative) or a backslash (which some
 * browsers normalize to a slash), and carry no control characters or spaces that
 * could smuggle a second URL. This is the guard against an open redirect through
 * the OAuth round-trip; an unsafe value is dropped so the callback falls back to
 * a safe default rather than honoring attacker-controlled navigation
 */
const isSafeReturnPath = (path: string): boolean => {
  if (path.length === 0 || path.length > 512) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\")) return false;

  for (let i = 0; i < path.length; i++) {
    if (path.charCodeAt(i) <= 0x20) return false;
  }

  return true;
};

/**
 * Derive the HMAC signing key from the hex-encoded TOKEN_ENCRYPTION_KEY. Matches
 * tokenEncryption's key handling (hex decode, require 32 bytes) so signing rides
 * on a secret the connect flow already requires, then domain-separates it so it
 * is never the literal encryption key
 */
const getHmacKey = () => {
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  const buf = Buffer.from(TOKEN_ENCRYPTION_KEY, "hex");

  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte (64 hex char) key");
  }

  return createHmac("sha256", buf).update(HMAC_KEY_LABEL).digest();
};

/** Compute the raw HMAC-SHA256 signature over the encoded payload */
const sign = (encodedPayload: string) =>
  createHmac("sha256", getHmacKey()).update(encodedPayload).digest();

/**
 * Sign an OAuth state that binds a bookId, with a random nonce and a short
 * expiry. Only the server (which holds TOKEN_ENCRYPTION_KEY) can produce a state
 * that verifies for a given book, closing the CSRF/account-linking hole where a
 * forged callback carrying a victim's raw bookId would be trusted.
 *
 * @param bookId - Book the OAuth flow targets.
 * @param opts - Optional `returnPath` (same-origin app path to land on after the
 *   round-trip; unsafe values are dropped) and `ttlMs` validity window (mainly
 *   for tests).
 * @returns `base64url(payload).base64url(signature)`.
 */
const signOauthState = (
  bookId: string,
  opts: { returnPath?: string; ttlMs?: number } = {},
): string => {
  const { returnPath, ttlMs = STATE_TTL_MS } = opts;

  const payload: StatePayload = {
    bookId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + ttlMs,
    // Only bind a return path that is a safe same-origin path; anything else is
    // silently omitted so the callback uses its default
    ...(returnPath && isSafeReturnPath(returnPath) ? { returnPath } : {}),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = sign(encodedPayload).toString("base64url");

  return `${encodedPayload}.${signature}`;
};

/**
 * Verify a signed OAuth state and return its bookId. Throws on a bad signature,
 * an expired state, or a malformed value. Error messages are static and never
 * include the raw state or the signing key; callers map every failure to a
 * single generic outcome.
 *
 * @param state - The signed state string from the OAuth callback.
 * @returns The bookId the state was signed for, and its safe returnPath if any.
 */
const verifyOauthState = (
  state: string,
): { bookId: string; returnPath?: string } => {
  const parts = state.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Malformed OAuth state");
  }

  const [encodedPayload, providedSig] = parts;

  // Verify the signature before trusting anything in the payload. Constant-time
  // compare; timingSafeEqual throws on a length mismatch, so guard the length
  const expectedSig = sign(encodedPayload);
  const providedSigBuf = Buffer.from(providedSig, "base64url");

  if (
    providedSigBuf.length !== expectedSig.length ||
    !timingSafeEqual(providedSigBuf, expectedSig)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("Malformed OAuth state");
  }

  if (typeof payload?.bookId !== "string" || typeof payload?.exp !== "number") {
    throw new Error("Malformed OAuth state");
  }

  if (Date.now() > payload.exp) {
    throw new Error("Expired OAuth state");
  }

  // Re-validate the return path on the way out (defense in depth): a state
  // signed by an older/looser version, or any value that is not a safe
  // same-origin path, is dropped rather than trusted
  const returnPath =
    typeof payload.returnPath === "string" &&
    isSafeReturnPath(payload.returnPath)
      ? payload.returnPath
      : undefined;

  return { bookId: payload.bookId, returnPath };
};

export { signOauthState, verifyOauthState };
