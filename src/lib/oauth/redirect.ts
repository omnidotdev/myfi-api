import { CORS_ALLOWED_ORIGINS } from "lib/config/env.config";

/**
 * App origin the browser should land on after an OAuth round-trip. The callback
 * routes are served from the API host, so a relative redirect would resolve
 * against the API origin (e.g. api.myfi.omni.dev) rather than the app. The app
 * origin is the first configured CORS origin (the app is the only browser
 * client), falling back to the local dev app when unset
 */
const appOrigin = (): string =>
  CORS_ALLOWED_ORIGINS?.split(",")[0]?.trim() || "http://localhost:3000";

/**
 * Build an absolute app redirect URL for an OAuth callback.
 *
 * @param returnPath - A validated same-origin path (from the signed OAuth
 *   state), or undefined when none was carried / it failed validation.
 * @param fallbackPath - Path to use when `returnPath` is absent.
 * @param errorParam - When set, appends `error=<param>` so the landing page can
 *   surface a generic failure (no secrets ever go in the URL).
 */
const buildOauthRedirect = (
  returnPath: string | undefined,
  fallbackPath: string,
  errorParam?: string,
): string => {
  const path = returnPath ?? fallbackPath;
  const withError = errorParam
    ? `${path}${path.includes("?") ? "&" : "?"}error=${errorParam}`
    : path;

  return `${appOrigin()}${withError}`;
};

export { buildOauthRedirect };
