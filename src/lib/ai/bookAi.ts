import { lookupBookAiScope } from "./bookAiScope";
import { SYNAPSE_BASE_URL, synapseProvisioner } from "./synapse";

import type { SynapseProvisioner } from "@omnidotdev/providers/ai";
import type { BookAiScope } from "./bookAiScope";

/**
 * Outcome of one managed AI call for a book. myfi sells AI as a feature of its
 * tiers (an included monthly allowance enforced by the Synapse gateway), so the
 * cap is a normal outcome, not an error:
 * - `allowance_used`: the gateway refused with 402 (the workspace's included AI
 *   allowance for the period is used). Bulk work silently uses rules only, the
 *   interactive suggest surfaces an upgrade prompt
 * - `unavailable`: AI is not configured, provisioning failed, or the gateway
 *   failed (e.g. 503). Callers fall back to deterministic rules
 */
export type BookAiOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "allowance_used" }
  | { status: "unavailable" };

/**
 * `bulk` is background categorization (bank sync, imports) that may run once per
 * transaction; `interactive` is a user asking for a suggestion
 */
type BookAiMode = "bulk" | "interactive";

interface BookAiRequest {
  bookId: string;
  /** Acting user's identity-provider id, when the call has one */
  actorId?: string;
  mode: BookAiMode;
}

export interface BookAiDeps {
  provisioner: Pick<SynapseProvisioner, "resolveKey"> | null;
  gatewayConfigured: boolean;
  lookupScope: (
    bookId: string,
    actorId?: string,
  ) => Promise<BookAiScope | null>;
  now?: () => number;
  log?: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
}

/**
 * After a 402, bulk work for that workspace skips the gateway for this window,
 * so a large sync does not ask once per transaction for an answer it already
 * has. This only remembers the gateway's refusal; the allowance itself lives in
 * the gateway and Aether, never here
 */
const ALLOWANCE_USED_SKIP_MS = 15 * 60 * 1000;

/** HTTP status carried by a Synapse or provider SDK error, when present */
const errorStatus = (err: unknown): number | undefined => {
  if (!err || typeof err !== "object" || !("status" in err)) return undefined;
  const { status } = err;
  return typeof status === "number" ? status : undefined;
};

/**
 * Classify a failed managed AI call. Only a gateway 402 means the included
 * allowance is used; everything else (503, other statuses, transport errors,
 * provisioning failures) is treated as AI being unavailable
 * @param err - Error thrown by provisioning or the gateway call
 */
export const aiFailureKind = (
  err: unknown,
): "allowance_used" | "unavailable" =>
  errorStatus(err) === 402 ? "allowance_used" : "unavailable";

/**
 * Create the book-scoped AI runner. Each call resolves a product-scoped key
 * billed to the book's workspace and hands it to `call`; there is no shared key
 * to fall back to. A 402 is never retried
 * @param deps - Provisioner, gateway config, scope lookup (injectable for tests)
 */
export const createBookAi = (deps: BookAiDeps) => {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? {
    info: (message: string) => console.info(message),
    warn: (message: string) => console.warn(message),
  };
  const allowanceUsedUntil = new Map<string, number>();

  const run = async <T>(
    request: BookAiRequest,
    call: (apiKey: string) => Promise<T>,
  ): Promise<BookAiOutcome<T>> => {
    const { provisioner } = deps;
    if (!provisioner || !deps.gatewayConfigured) {
      return { status: "unavailable" };
    }

    const scope = await deps.lookupScope(request.bookId, request.actorId);
    if (!scope) {
      log.warn(`[ai] no billable scope for book ${request.bookId}`);
      return { status: "unavailable" };
    }

    const { organizationId } = scope;
    const skipUntil = allowanceUsedUntil.get(organizationId);
    if (request.mode === "bulk" && skipUntil !== undefined) {
      if (now() < skipUntil) return { status: "allowance_used" };
      allowanceUsedUntil.delete(organizationId);
    }

    try {
      const apiKey = await provisioner.resolveKey(
        scope.keyHolderId,
        undefined,
        {
          entityType: "organization",
          entityId: organizationId,
        },
      );
      const value = await call(apiKey);
      allowanceUsedUntil.delete(organizationId);
      return { status: "ok", value };
    } catch (err) {
      const kind = aiFailureKind(err);
      if (kind === "allowance_used") {
        allowanceUsedUntil.set(organizationId, now() + ALLOWANCE_USED_SKIP_MS);
        log.info(
          `[ai] included AI allowance used for organization ${organizationId}, using rules only`,
        );
      } else {
        const reason = err instanceof Error ? err.message : "unknown error";
        log.warn(`[ai] AI categorization unavailable: ${reason}`);
      }
      return { status: kind };
    }
  };

  return { run };
};

/** Book-scoped AI runner wired to the configured Synapse provisioner */
const bookAi = createBookAi({
  provisioner: synapseProvisioner,
  gatewayConfigured: !!SYNAPSE_BASE_URL,
  lookupScope: lookupBookAiScope,
});

export default bookAi;
