import { AsyncLocalStorage } from "node:async_hooks";

interface AuditActor {
  id: string;
  name?: string;
  email?: string;
}

/**
 * Request-scoped store for the acting user, so audit events can record WHO made
 * a change without every route handler having to thread the user through. The
 * auth middleware seeds it once per request (via setAuditActor); emitAudit reads
 * it when a call site does not pass an explicit actor
 */
const auditActorStore = new AsyncLocalStorage<AuditActor>();

/**
 * Bind the acting user for the current request's async context. Uses enterWith
 * so it applies to the rest of the request (the handler and its awaits) without
 * wrapping, which fits Elysia's derive lifecycle
 */
export const setAuditActor = (actor: AuditActor): void => {
  auditActorStore.enterWith(actor);
};

/** The acting user bound to the current request, or undefined outside one */
export const getAuditActor = (): AuditActor | undefined =>
  auditActorStore.getStore();
