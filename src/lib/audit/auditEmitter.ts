import { getAuditActor } from "lib/audit/auditContext";
import { events } from "lib/providers";

type AuditActor = {
  id: string;
  name?: string;
  email?: string;
};

type AuditEvent = {
  type: string;
  organizationId: string;
  /**
   * The acting user. Optional: when omitted, the request-scoped actor bound by
   * the auth middleware is used, falling back to the system actor. Prefer
   * omitting it so the real user is captured automatically
   */
  actor?: AuditActor;
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  data?: Record<string, unknown>;
};

const SYSTEM_ACTOR: AuditActor = {
  id: "system",
  name: "MyFi System",
};

/**
 * Emit an audit event to Vortex/Chronicle.
 * Fire-and-forget: never blocks the caller, logs warning on failure
 */
const emitAudit = (event: AuditEvent): void => {
  const actor = event.actor ?? getAuditActor() ?? SYSTEM_ACTOR;
  events
    .emit({
      type: event.type,
      organizationId: event.organizationId,
      subject: event.resource.id,
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        resourceType: event.resource.type,
        resourceId: event.resource.id,
        resourceName: event.resource.name,
        ...event.data,
      },
    })
    .catch((err) => {
      console.warn("[Audit] Failed to emit event:", err);
    });
};

export { emitAudit, SYSTEM_ACTOR };
