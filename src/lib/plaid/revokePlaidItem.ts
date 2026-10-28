import { decryptToken } from "lib/encryption/tokenEncryption";
import plaidClient from "./plaidClient";

/**
 * Ask Plaid to remove (invalidate) the item behind a connected account's access
 * token. Best effort: Plaid errors (an already-removed item, a transient
 * network failure) are logged and swallowed so disconnecting a bank never fails
 * on the provider call. Returns whether Plaid confirmed the removal, so the
 * caller can decide whether to retry; the caller should clear the stored token
 * regardless, since a token that can no longer be used is not worth keeping
 */
export const revokePlaidItem = async (
  encryptedAccessToken: string,
): Promise<boolean> => {
  try {
    const access_token = decryptToken(encryptedAccessToken);
    await plaidClient.itemRemove({ access_token });
    return true;
  } catch (err) {
    console.warn(
      "[plaid] itemRemove failed; the item may remain active:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
};
