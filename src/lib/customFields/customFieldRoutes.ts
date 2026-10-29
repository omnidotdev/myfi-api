import { and, asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "lib/db/schema";
import { authorizeBook } from "lib/middleware/bookAccess.middleware";
import { setCustomFieldValues } from "./setCustomFieldValues";

const ENTITY_TYPES = ["customer", "invoice", "vendor", "item"];
const FIELD_TYPES = ["text", "number", "date", "boolean"];

/**
 * Custom fields: user-defined fields per entity type and their values on
 * specific rows. Definition CRUD and value upserts are book-scoped (viewer
 * reads, editor writes) by the global bookAccessMiddleware via bookId in the
 * query or body; id-addressed routes resolve the owning book themselves
 */
const customFieldRoutes = new Elysia({ prefix: "/api/custom-fields" })
  .get("/definitions", async ({ query, set }) => {
    const { bookId, entityType } = query;
    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }
    const where = entityType
      ? and(
          eq(customFieldDefinitionTable.bookId, bookId),
          eq(customFieldDefinitionTable.entityType, entityType),
        )
      : eq(customFieldDefinitionTable.bookId, bookId);
    const definitions = await dbPool
      .select()
      .from(customFieldDefinitionTable)
      .where(where)
      .orderBy(asc(customFieldDefinitionTable.position));
    return { definitions };
  })
  .post(
    "/definitions",
    async ({ body, set }) => {
      if (!ENTITY_TYPES.includes(body.entityType)) {
        set.status = 400;
        return {
          error: `entityType must be one of ${ENTITY_TYPES.join(", ")}`,
        };
      }
      if (body.fieldType && !FIELD_TYPES.includes(body.fieldType)) {
        set.status = 400;
        return { error: `fieldType must be one of ${FIELD_TYPES.join(", ")}` };
      }
      const [definition] = await dbPool
        .insert(customFieldDefinitionTable)
        .values({
          bookId: body.bookId,
          entityType: body.entityType,
          label: body.label,
          fieldType: body.fieldType ?? "text",
          position: body.position ?? 0,
        })
        .returning();
      set.status = 201;
      return { definition };
    },
    {
      body: t.Object({
        bookId: t.String(),
        entityType: t.String(),
        label: t.String(),
        fieldType: t.Optional(t.String()),
        position: t.Optional(t.Number()),
      }),
    },
  )
  .patch(
    "/definitions/:id",
    async ({ params, body, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Custom field not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.label !== undefined) updates.label = body.label;
      if (body.position !== undefined) updates.position = body.position;
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      const [definition] = await dbPool
        .update(customFieldDefinitionTable)
        .set(updates)
        .where(eq(customFieldDefinitionTable.id, params.id))
        .returning();
      return { definition };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        label: t.Optional(t.String()),
        position: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/definitions/:id",
    async ({ params, set, request }) => {
      const [existing] = await dbPool
        .select()
        .from(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.id, params.id));
      if (!existing) {
        set.status = 404;
        return { error: "Custom field not found" };
      }
      const auth = await authorizeBook(request, existing.bookId, "editor", set);
      if (!auth) return { error: "Forbidden" };

      await dbPool
        .delete(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Values for one entity row, joined with their definitions for display
  .get("/values", async ({ query, set }) => {
    const { bookId, entityType, entityId } = query;
    if (!bookId || !entityType || !entityId) {
      set.status = 400;
      return { error: "bookId, entityType, and entityId are required" };
    }
    const rows = await dbPool
      .select({
        definitionId: customFieldDefinitionTable.id,
        label: customFieldDefinitionTable.label,
        fieldType: customFieldDefinitionTable.fieldType,
        position: customFieldDefinitionTable.position,
        value: customFieldValueTable.value,
      })
      .from(customFieldDefinitionTable)
      .leftJoin(
        customFieldValueTable,
        and(
          eq(customFieldValueTable.definitionId, customFieldDefinitionTable.id),
          eq(customFieldValueTable.entityId, entityId),
        ),
      )
      .where(
        and(
          eq(customFieldDefinitionTable.bookId, bookId),
          eq(customFieldDefinitionTable.entityType, entityType),
          eq(customFieldDefinitionTable.isActive, true),
        ),
      )
      .orderBy(asc(customFieldDefinitionTable.position));
    return { fields: rows };
  })
  .put(
    "/values",
    async ({ body, set }) => {
      try {
        const count = await setCustomFieldValues({
          bookId: body.bookId,
          entityId: body.entityId,
          values: body.values,
        });
        return { success: true, count };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        set.status = /belong to this book/i.test(message) ? 400 : 500;
        return { error: message };
      }
    },
    {
      body: t.Object({
        bookId: t.String(),
        entityId: t.String(),
        values: t.Array(
          t.Object({
            definitionId: t.String(),
            value: t.Union([t.String(), t.Null()]),
          }),
        ),
      }),
    },
  );

export default customFieldRoutes;
