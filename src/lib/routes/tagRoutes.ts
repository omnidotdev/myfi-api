import { eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { emitAudit } from "lib/audit";
import { dbPool } from "lib/db/db";
import {
  journalEntryTable,
  journalLineTable,
  journalLineTagTable,
  tagGroupTable,
  tagTable,
} from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";

// Tag CRUD routes
const tagRoutes = new Elysia({ prefix: "/api/tags" })
  // List tag groups with their tags
  .get("/groups", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const groups = await dbPool
      .select()
      .from(tagGroupTable)
      .where(eq(tagGroupTable.bookId, bookId));

    const groupsWithTags = await Promise.all(
      groups.map(async (group) => {
        const tags = await dbPool
          .select()
          .from(tagTable)
          .where(eq(tagTable.tagGroupId, group.id));

        return { ...group, tags };
      }),
    );

    return { groups: groupsWithTags };
  })
  // Create tag group
  .post(
    "/groups",
    async ({ body, set }) => {
      const [group] = await dbPool
        .insert(tagGroupTable)
        .values({ bookId: body.bookId, name: body.name })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.tag_group.created",
        organizationId: body.bookId,
        resource: { type: "tag_group", id: group.id, name: group.name },
        data: { bookId: body.bookId },
      });

      return { group };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
      }),
    },
  )
  // Delete tag group
  .delete(
    "/groups/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(tagGroupTable)
        .where(eq(tagGroupTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tag group not found" };
      }

      // Addressed by group id, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the group's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool.delete(tagGroupTable).where(eq(tagGroupTable.id, params.id));

      emitAudit({
        type: "myfi.tag_group.deleted",
        organizationId: existing.bookId,
        resource: {
          type: "tag_group",
          id: existing.id,
          name: existing.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // Create tag
  .post(
    "/",
    async ({ body, set, request }) => {
      const [group] = await dbPool
        .select({ bookId: tagGroupTable.bookId })
        .from(tagGroupTable)
        .where(eq(tagGroupTable.id, body.tagGroupId));

      if (!group) {
        set.status = 404;
        return { error: "Tag group not found" };
      }

      // Keyed by tag group, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the group's own book
      const auth = await authorizeBook(request, group.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const [tag] = await dbPool
        .insert(tagTable)
        .values({
          tagGroupId: body.tagGroupId,
          name: body.name,
          code: body.code ?? null,
        })
        .returning();

      set.status = 201;

      emitAudit({
        type: "myfi.tag.created",
        organizationId: group.bookId,
        resource: { type: "tag", id: tag.id, name: tag.name },
        data: { tagGroupId: body.tagGroupId },
      });

      return { tag };
    },
    {
      body: t.Object({
        tagGroupId: t.String(),
        name: t.String(),
        code: t.Optional(t.String()),
      }),
    },
  )
  // Update tag
  .patch(
    "/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select({
          id: tagTable.id,
          tagGroupId: tagTable.tagGroupId,
          bookId: tagGroupTable.bookId,
        })
        .from(tagTable)
        .innerJoin(tagGroupTable, eq(tagTable.tagGroupId, tagGroupTable.id))
        .where(eq(tagTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tag not found" };
      }

      // Addressed by tag id, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the tag's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const [tag] = await dbPool
        .update(tagTable)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.code !== undefined && { code: body.code }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        })
        .where(eq(tagTable.id, params.id))
        .returning();

      emitAudit({
        type: "myfi.tag.updated",
        organizationId: existing.bookId,
        resource: { type: "tag", id: tag.id, name: tag.name },
      });

      return { tag };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        code: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  // Delete tag
  .delete(
    "/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select({
          id: tagTable.id,
          name: tagTable.name,
          bookId: tagGroupTable.bookId,
        })
        .from(tagTable)
        .innerJoin(tagGroupTable, eq(tagTable.tagGroupId, tagGroupTable.id))
        .where(eq(tagTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Tag not found" };
      }

      // Addressed by tag id, not a `bookId` field, so the global middleware
      // does not guard it: require editor on the tag's own book
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool.delete(tagTable).where(eq(tagTable.id, params.id));

      emitAudit({
        type: "myfi.tag.deleted",
        organizationId: existing.bookId,
        resource: {
          type: "tag",
          id: existing.id,
          name: existing.name,
        },
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // Bulk tag journal lines
  .post(
    "/line-tags",
    async ({ body, set, request }) => {
      // Keyed by journal line and tag ids, not a `bookId` field, so the global
      // middleware does not guard it: resolve the book of every referenced
      // line and tag, then require editor on each distinct book
      const journalLineIds = [
        ...new Set(body.tags.map((tag) => tag.journalLineId)),
      ];
      const tagIds = [...new Set(body.tags.map((tag) => tag.tagId))];

      const [lines, tags] = await Promise.all([
        journalLineIds.length
          ? dbPool
              .select({ bookId: journalEntryTable.bookId })
              .from(journalLineTable)
              .innerJoin(
                journalEntryTable,
                eq(journalLineTable.journalEntryId, journalEntryTable.id),
              )
              .where(inArray(journalLineTable.id, journalLineIds))
          : Promise.resolve([]),
        tagIds.length
          ? dbPool
              .select({ bookId: tagGroupTable.bookId })
              .from(tagTable)
              .innerJoin(
                tagGroupTable,
                eq(tagTable.tagGroupId, tagGroupTable.id),
              )
              .where(inArray(tagTable.id, tagIds))
          : Promise.resolve([]),
      ]);

      const bookIds = new Set<string>([
        ...lines.map((line) => line.bookId),
        ...tags.map((tag) => tag.bookId),
      ]);

      for (const bookId of bookIds) {
        const auth = await authorizeBook(request, bookId, "editor", set);
        if (!auth) return { error: "Forbidden" };
      }

      const rows = await dbPool
        .insert(journalLineTagTable)
        .values(
          body.tags.map((tag) => ({
            journalLineId: tag.journalLineId,
            tagId: tag.tagId,
          })),
        )
        .onConflictDoNothing({
          target: [
            journalLineTagTable.journalLineId,
            journalLineTagTable.tagId,
          ],
        })
        .returning();

      return { created: rows.length };
    },
    {
      body: t.Object({
        tags: t.Array(
          t.Object({
            journalLineId: t.String(),
            tagId: t.String(),
          }),
        ),
      }),
    },
  )
  // Remove tag from journal line
  .delete(
    "/line-tags/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select({
          id: journalLineTagTable.id,
          bookId: tagGroupTable.bookId,
        })
        .from(journalLineTagTable)
        .innerJoin(tagTable, eq(journalLineTagTable.tagId, tagTable.id))
        .innerJoin(tagGroupTable, eq(tagTable.tagGroupId, tagGroupTable.id))
        .where(eq(journalLineTagTable.id, params.id));

      if (!existing) {
        set.status = 404;
        return { error: "Journal line tag not found" };
      }

      // Addressed by row id, not a `bookId` field, so the global middleware
      // does not guard it: resolve the book via the tag and require editor
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(journalLineTagTable)
        .where(eq(journalLineTagTable.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default tagRoutes;
