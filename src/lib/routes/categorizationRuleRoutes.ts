import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { categorizationRuleTable } from "lib/db/schema";

// Categorization rule routes
const categorizationRuleRoutes = new Elysia({
  prefix: "/api/categorization-rules",
})
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const rules = await dbPool
      .select()
      .from(categorizationRuleTable)
      .where(eq(categorizationRuleTable.bookId, bookId))
      .orderBy(desc(categorizationRuleTable.priority));

    return { rules };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const [rule] = await dbPool
        .insert(categorizationRuleTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          matchField: body.matchField,
          matchType: body.matchType,
          matchValue: body.matchValue,
          debitAccountId: body.debitAccountId,
          creditAccountId: body.creditAccountId,
          amountMin: body.amountMin ?? null,
          amountMax: body.amountMax ?? null,
          confidence: body.confidence ?? "1.00",
          priority: body.priority ?? 0,
        })
        .returning();

      set.status = 201;

      return { rule };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        matchField: t.String(),
        matchType: t.String(),
        matchValue: t.String(),
        debitAccountId: t.String(),
        creditAccountId: t.String(),
        amountMin: t.Optional(t.Nullable(t.String())),
        amountMax: t.Optional(t.Nullable(t.String())),
        confidence: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: categorizationRuleTable.id })
        .from(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Categorization rule not found" };
      }

      const [rule] = await dbPool
        .update(categorizationRuleTable)
        .set(body)
        .where(eq(categorizationRuleTable.id, id))
        .returning();

      return { rule };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        matchField: t.Optional(t.String()),
        matchType: t.Optional(t.String()),
        matchValue: t.Optional(t.String()),
        debitAccountId: t.Optional(t.String()),
        creditAccountId: t.Optional(t.String()),
        amountMin: t.Optional(t.Nullable(t.String())),
        amountMax: t.Optional(t.Nullable(t.String())),
        confidence: t.Optional(t.String()),
        priority: t.Optional(t.Number()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: categorizationRuleTable.id })
        .from(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Categorization rule not found" };
      }

      await dbPool
        .delete(categorizationRuleTable)
        .where(eq(categorizationRuleTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default categorizationRuleRoutes;
