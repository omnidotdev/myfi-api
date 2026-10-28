import { GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET } from "lib/config/env.config";
import { decryptToken } from "lib/encryption/tokenEncryption";

const BASE_URL = "https://api.gusto.com";

/**
 * Ask Gusto to revoke an access token so a disconnected payroll connection can
 * no longer be used to reach the company's data. Best effort: a missing client
 * credential, a non-OK response, or a network failure is logged and swallowed,
 * and the caller clears the stored tokens regardless, since a token that may
 * still be valid must not be kept once the user has disconnected
 */
export const revokeGustoToken = async (
  encryptedAccessToken: string,
): Promise<boolean> => {
  if (!GUSTO_CLIENT_ID || !GUSTO_CLIENT_SECRET) {
    console.warn("[gusto] client credentials unset, cannot revoke token");
    return false;
  }
  try {
    const token = decryptToken(encryptedAccessToken);
    const res = await fetch(`${BASE_URL}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GUSTO_CLIENT_ID,
        client_secret: GUSTO_CLIENT_SECRET,
        token,
      }),
    });
    if (!res.ok) {
      console.warn(`[gusto] token revoke returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[gusto] token revoke failed; the token may remain valid:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
};
