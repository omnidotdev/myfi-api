import { createEventsProvider } from "@omnidotdev/providers";

import { VORTEX_API_KEY, VORTEX_API_URL } from "lib/config/env.config";

/**
 * Shared events provider instance.
 * Falls back to noop when Vortex is not configured
 */
const events =
  VORTEX_API_URL && VORTEX_API_KEY
    ? createEventsProvider({
        provider: "http",
        baseUrl: VORTEX_API_URL,
        apiKey: VORTEX_API_KEY,
        source: "omni.myfi",
      })
    : createEventsProvider({});

if (!VORTEX_API_URL || !VORTEX_API_KEY) {
  console.warn("VORTEX_API_URL/VORTEX_API_KEY not set, audit logging disabled");
}

export { events };
