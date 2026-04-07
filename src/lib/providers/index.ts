import {
  createEventsProvider,
  createNotificationProvider,
} from "@omnidotdev/providers";

import {
  NOTIFICATION_FROM_EMAIL,
  RESEND_API_KEY,
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
 * Falls back to noop when Resend is not configured
 */
const notifications =
  RESEND_API_KEY && NOTIFICATION_FROM_EMAIL
    ? createNotificationProvider({
        provider: "resend",
        apiKey: RESEND_API_KEY,
        defaultFrom: NOTIFICATION_FROM_EMAIL,
      })
    : createNotificationProvider({});

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set, email notifications disabled");
}

export { events, notifications };
