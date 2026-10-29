import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import {
  extractBearerToken,
  resolveUserFromToken,
  resolveUserOrgIds,
} from "lib/auth";
import { purgeOwnedBooksInOrg } from "lib/books/purgeOwnedBooksInOrg";

/**
 * Organization-scoped data actions. The self-service workspace-data deletion
 * here removes every book the caller OWNS in the organization (cascading its
 * data); it never touches books owned by others. User identity and credentials
 * live in Gatekeeper, not MyFi, so deleting those is out of scope for this
 * service: this covers "delete my workspace's accounting data"
 */
const orgDataRoutes = new Elysia({ prefix: "/api/organizations" }).delete(
  "/:organizationId/data",
  async ({ params, body, set, request }) => {
    const { organizationId } = params;

    // Confirmation: the caller must echo the organization id back, so a stray
    // request can never wipe a workspace's financial data by accident
    if (body.confirmOrganizationId !== organizationId) {
      set.status = 400;
      return { error: "confirmOrganizationId must match the organization id" };
    }

    // Addressed by organization id with no bookId, so the global book-access
    // middleware does not guard it: authorize here from the bearer token
    const token = extractBearerToken(request.headers.get("authorization"));
    const user = token ? await resolveUserFromToken(token) : null;
    if (!user?.id) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    const orgIds = token ? await resolveUserOrgIds(token) : [];
    if (!orgIds.includes(organizationId)) {
      set.status = 403;
      return { error: "Forbidden" };
    }

    const result = await purgeOwnedBooksInOrg(user.id, organizationId);

    emitAudit({
      type: "myfi.organization.data_purged",
      organizationId,
      actor: { id: user.id },
      resource: { type: "organization", id: organizationId },
      data: {
        deletedCount: result.deletedBookIds.length,
        skippedCount: result.skippedBookIds.length,
      },
    });

    return result;
  },
  {
    params: t.Object({ organizationId: t.String() }),
    body: t.Object({ confirmOrganizationId: t.String() }),
  },
);

export default orgDataRoutes;
