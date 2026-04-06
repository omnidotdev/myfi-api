import { events } from "lib/providers";

type AuditActor = {
  id: string;
  name?: string;
  email?: string;
};

type AuditEvent = {
  type: string;
  organizationId: string;
  actor: AuditActor;
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
  events
    .emit({
      type: event.type,
      organizationId: event.organizationId,
      subject: event.resource.id,
      data: {
        actorId: event.actor.id,
        actorName: event.actor.name,
        actorEmail: event.actor.email,
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
