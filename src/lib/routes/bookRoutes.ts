import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { extractBearerToken, resolveUserFromToken } from "lib/auth";
import { dbPool } from "lib/db/db";
import { accountTable, bookAccessTable, bookTable } from "lib/db/schema";
import {
  llcTemplate,
  personalTemplate,
  soleProprietorTemplate,
} from "lib/db/templates";

import type { InsertAccount } from "lib/db/schema";
import type { AccountTemplate } from "lib/db/templates";

/**
 * Resolve the authenticated user from the request.
 * Auth middleware has already verified the token, so this is a fast re-parse.
 */
const getActor = async (request: Request) => {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { id: "unknown" };
  const user = await resolveUserFromToken(token);
  return user ?? { id: "unknown" };
};

/**
 * Flatten a hierarchical account template into insert-ready rows.
 * @param templates - Nested account template definitions
 * @param bookId - Book to associate accounts with
 * @param parentId - Parent account ID for nested children
 */
const flattenTemplate = (
  templates: AccountTemplate[],
  bookId: string,
  parentId?: string,
): InsertAccount[] => {
  const rows: InsertAccount[] = [];

  for (const tpl of templates) {
    // Generate a placeholder ID so children can reference it
    const id = crypto.randomUUID();

    rows.push({
      id,
      bookId,
      parentId: parentId ?? null,
      name: tpl.name,
      code: tpl.code,
      type: tpl.type,
      subType: tpl.subType ?? null,
      isPlaceholder: tpl.isPlaceholder ?? false,
      isActive: true,
    });

    if (tpl.children?.length) {
      rows.push(...flattenTemplate(tpl.children, bookId, id));
    }
  }

  return rows;
};

const TEMPLATE_MAP: Record<string, AccountTemplate[]> = {
  personal: personalTemplate,
  sole_proprietor: soleProprietorTemplate,
  llc: llcTemplate,
};

// Book CRUD routes
const bookRoutes = new Elysia({ prefix: "/api/books" })
  .get("/", async ({ query, set, request }) => {
    const { organizationId } = query;
    const actor = await getActor(request);

    if (!organizationId) {
      set.status = 400;
      return { error: "organizationId is required" };
    }

    // Fetch book IDs the user has access to
    const accessRecords = await dbPool
      .select({ bookId: bookAccessTable.bookId })
      .from(bookAccessTable)
      .where(eq(bookAccessTable.userId, actor.id));

    const accessibleBookIds = accessRecords.map((r) => r.bookId);

    // If user has no book access, return empty list
    if (accessibleBookIds.length === 0) {
      return { books: [] };
    }

    const books = await dbPool
      .select()
      .from(bookTable)
      .where(eq(bookTable.organizationId, organizationId));

    // Filter to only books the user has access to
    const filteredBooks = books.filter((b) => accessibleBookIds.includes(b.id));

    return { books: filteredBooks };
  })
  .post(
    "/",
    async ({ body, set, request }) => {
      const {
        organizationId,
        name,
        type,
        currency,
        fiscalYearStartMonth,
        template,
      } = body;
      const actor = await getActor(request);

      const [book] = await dbPool
        .insert(bookTable)
        .values({
          organizationId,
          name,
          type,
          currency: currency ?? "USD",
          fiscalYearStartMonth: fiscalYearStartMonth ?? 1,
        })
        .returning();

      // Grant owner access to the creating user
      await dbPool
        .insert(bookAccessTable)
        .values({
          bookId: book.id,
          userId: actor.id,
          role: "owner",
        })
        .onConflictDoNothing();

      // Seed template accounts if a template was specified
      if (template && TEMPLATE_MAP[template]) {
        const rows = flattenTemplate(TEMPLATE_MAP[template], book.id);

        if (rows.length) {
          await dbPool.insert(accountTable).values(rows);
        }
      }

      set.status = 201;

      emitAudit({
        type: "myfi.book.created",
        organizationId: book.organizationId,
        actor: { id: actor.id },
        resource: { type: "book", id: book.id, name: book.name },
        data: { bookType: book.type },
      });

      return { book };
    },
    {
      body: t.Object({
        organizationId: t.String(),
        name: t.String(),
        type: t.Union([t.Literal("business"), t.Literal("personal")]),
        currency: t.Optional(t.String()),
        fiscalYearStartMonth: t.Optional(t.Number()),
        template: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/:id",
    async ({ params, body, set, request }) => {
      const { id } = params;
      const actor = await getActor(request);

      const [existing] = await dbPool
        .select({
          id: bookTable.id,
          organizationId: bookTable.organizationId,
        })
        .from(bookTable)
        .where(eq(bookTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Book not found" };
      }

      const [book] = await dbPool
        .update(bookTable)
        .set({
          name: body.name,
          type: body.type,
          currency: body.currency,
          fiscalYearStartMonth: body.fiscalYearStartMonth,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(bookTable.id, id))
        .returning();

      emitAudit({
        type: "myfi.book.updated",
        organizationId: existing.organizationId,
        actor: { id: actor.id },
        resource: { type: "book", id: book.id, name: book.name },
      });

      return { book };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        type: t.Optional(
          t.Union([t.Literal("business"), t.Literal("personal")]),
        ),
        currency: t.Optional(t.String()),
        fiscalYearStartMonth: t.Optional(t.Number()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const { id } = params;
      const actor = await getActor(request);

      const [existing] = await dbPool
        .select({
          id: bookTable.id,
          organizationId: bookTable.organizationId,
          name: bookTable.name,
        })
        .from(bookTable)
        .where(eq(bookTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Book not found" };
      }

      await dbPool.delete(bookTable).where(eq(bookTable.id, id));

      emitAudit({
        type: "myfi.book.deleted",
        organizationId: existing.organizationId,
        actor: { id: actor.id },
        resource: { type: "book", id: existing.id, name: existing.name },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default bookRoutes;
