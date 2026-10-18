import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { accountMappingTable } from "lib/db/schema";
import { seedDefaultMantleMappings } from "lib/mantle/defaultMappings";

// Account mapping routes
const mappingRoutes = new Elysia({ prefix: "/api/account-mappings" })
  .get("/", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const mappings = await dbPool
      .select()
      .from(accountMappingTable)
      .where(eq(accountMappingTable.bookId, bookId));

    return { mappings };
  })
  .post(
    "/",
    async ({ body, set }) => {
      const { bookId, eventType, debitAccountId, creditAccountId } = body;

      // Upsert: check for existing mapping with same bookId+eventType
      const [existing] = await dbPool
        .select({ id: accountMappingTable.id })
        .from(accountMappingTable)
        .where(
          and(
            eq(accountMappingTable.bookId, bookId),
            eq(accountMappingTable.eventType, eventType),
          ),
        );

      if (existing) {
        const [mapping] = await dbPool
          .update(accountMappingTable)
          .set({
            debitAccountId,
            creditAccountId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(accountMappingTable.id, existing.id))
          .returning();

        return { mapping };
      }

      const [mapping] = await dbPool
        .insert(accountMappingTable)
        .values({
          bookId,
          eventType,
          debitAccountId,
          creditAccountId,
        })
        .returning();

      set.status = 201;

      return { mapping };
    },
    {
      body: t.Object({
        bookId: t.String(),
        eventType: t.String(),
        debitAccountId: t.String(),
        creditAccountId: t.String(),
      }),
    },
  )
  // Create the default Mantle mappings for a book from its standard chart of
  // accounts. Additive: only fills event types that have no mapping yet, and
  // only those whose standard accounts resolve, so it never overwrites a
  // hand-tuned mapping. Returns the mappings it created
  .post(
    "/seed-mantle-defaults",
    async ({ body }) => {
      const created = await seedDefaultMantleMappings(body.bookId);
      return { created };
    },
    { body: t.Object({ bookId: t.String() }) },
  );

export default mappingRoutes;
