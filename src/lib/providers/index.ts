import {
  createEventsProvider,
  createNotificationProvider,
} from "@omnidotdev/providers";

import {
  HERALD_API_KEY,
  HERALD_API_URL,
  NOTIFICATION_FROM_EMAIL,
  VORTEX_API_KEY,
  VORTEX_API_URL,
} from "lib/config/env.config";

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

/**
 * Shared notification provider instance.
 * Falls back to noop when Herald is not configured
 */
const notifications =
  HERALD_API_URL && HERALD_API_KEY
    ? createNotificationProvider({
        provider: "herald",
        apiKey: HERALD_API_KEY,
        apiUrl: HERALD_API_URL,
        defaultFrom: NOTIFICATION_FROM_EMAIL ?? "noreply@send.omni.dev",
      })
    : createNotificationProvider({});

if (!HERALD_API_URL || !HERALD_API_KEY) {
  console.warn("HERALD_API_URL/HERALD_API_KEY not set, email notifications disabled");
}

export { events, notifications };
