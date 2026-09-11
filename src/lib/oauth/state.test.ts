import { describe, expect, mock, test } from "bun:test";

// A valid 32-byte (64 hex char) key so the HMAC key derivation succeeds. The
// state module imports TOKEN_ENCRYPTION_KEY from env.config, so mock it before
// importing the subject. Spread the real module so unrelated named exports stay
// present: mock.module is global across files, and dropping them would break
// other modules that statically import those names
const TEST_KEY = "a".repeat(64);
const realEnv = await import("lib/config/env.config");
mock.module("lib/config/env.config", () => ({
  ...realEnv,
  TOKEN_ENCRYPTION_KEY: TEST_KEY,
}));

const { signOauthState, verifyOauthState } = await import("./state");

describe("signOauthState / verifyOauthState", () => {
  test("round-trips: a signed state verifies back to the bookId", () => {
    const state = signOauthState("book-1");
    expect(verifyOauthState(state)).toEqual({ bookId: "book-1" });
  });

  test("the signed state is not the raw bookId", () => {
    const state = signOauthState("book-1");
    expect(state).not.toBe("book-1");
    expect(state).toContain(".");
  });

  test("two signatures of the same bookId differ (nonce)", () => {
    expect(signOauthState("book-1")).not.toBe(signOauthState("book-1"));
  });

  test("a tampered payload fails to verify", () => {
    const state = signOauthState("book-1");
    const [, sig] = state.split(".");
    // Re-encode a different bookId while keeping the original signature
    const forgedPayload = Buffer.from(
      JSON.stringify({
        bookId: "victim-book",
        nonce: "x",
        exp: Date.now() + 1000,
      }),
      "utf8",
    ).toString("base64url");

    expect(() => verifyOauthState(`${forgedPayload}.${sig}`)).toThrow();
  });

  test("a tampered signature fails to verify", () => {
    const state = signOauthState("book-1");
    const [payload] = state.split(".");
    const badSig = Buffer.from("not-the-real-signature").toString("base64url");

    expect(() => verifyOauthState(`${payload}.${badSig}`)).toThrow();
  });

  test("an expired state fails to verify", () => {
    // A negative TTL puts the expiry in the past, so verification rejects it
    const expired = signOauthState("book-1", -1000);
    expect(() => verifyOauthState(expired)).toThrow();
  });

  test("a malformed state with no dot fails to verify", () => {
    expect(() => verifyOauthState("no-dot-here")).toThrow();
  });

  test("a malformed state with bad base64 payload fails to verify", () => {
    expect(() => verifyOauthState("!!!.@@@")).toThrow();
  });

  test("errors never contain the signing key", () => {
    for (const bad of [
      "no-dot-here",
      "!!!.@@@",
      `${signOauthState("b", -1)}`,
    ]) {
      try {
        verifyOauthState(bad);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).not.toContain(TEST_KEY);
      }
    }
  });
});
