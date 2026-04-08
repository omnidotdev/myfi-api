import { and, desc, eq, like, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool } from "lib/db/db";
import { mileageLogTable, vehicleTable } from "lib/db/schema";

// Standard IRS mileage rates by tax year
const IRS_MILEAGE_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.7,
  2026: 0.7,
};

const getMileageRate = (year: number): number =>
  IRS_MILEAGE_RATES[year] ?? IRS_MILEAGE_RATES[2025];

// Mileage log and vehicle CRUD routes
const mileageRoutes = new Elysia({ prefix: "/api/mileage" })
  .get("/", async ({ query, set }) => {
    const { bookId, year } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const conditions = [eq(mileageLogTable.bookId, bookId)];

    if (year) {
      conditions.push(like(mileageLogTable.date, `${year}%`));
    }

    const logs = await dbPool
      .select({
        id: mileageLogTable.id,
        bookId: mileageLogTable.bookId,
        vehicleId: mileageLogTable.vehicleId,
        date: mileageLogTable.date,
        description: mileageLogTable.description,
        origin: mileageLogTable.origin,
        destination: mileageLogTable.destination,
        odometerStart: mileageLogTable.odometerStart,
        odometerEnd: mileageLogTable.odometerEnd,
        distance: mileageLogTable.distance,
        isRoundTrip: mileageLogTable.isRoundTrip,
        createdAt: mileageLogTable.createdAt,
        updatedAt: mileageLogTable.updatedAt,
        vehicleName: vehicleTable.name,
      })
      .from(mileageLogTable)
      .innerJoin(vehicleTable, eq(mileageLogTable.vehicleId, vehicleTable.id))
      .where(and(...conditions))
      .orderBy(desc(mileageLogTable.date));

    return { logs };
  })
  .post(
    "/",
    async ({ body, set }) => {
      let distance = Number(body.distance);

      if (body.isRoundTrip) {
        distance *= 2;
      }

      const [log] = await dbPool
        .insert(mileageLogTable)
        .values({
          bookId: body.bookId,
          vehicleId: body.vehicleId,
          date: body.date,
          description: body.description ?? null,
          origin: body.origin ?? null,
          destination: body.destination ?? null,
          odometerStart: body.odometerStart ?? null,
          odometerEnd: body.odometerEnd ?? null,
          distance: distance.toFixed(1),
          isRoundTrip: body.isRoundTrip ?? false,
        })
        .returning();

      set.status = 201;

      return { log };
    },
    {
      body: t.Object({
        bookId: t.String(),
        vehicleId: t.String(),
        date: t.String(),
        description: t.Optional(t.String()),
        origin: t.Optional(t.String()),
        destination: t.Optional(t.String()),
        odometerStart: t.Optional(t.String()),
        odometerEnd: t.Optional(t.String()),
        distance: t.String(),
        isRoundTrip: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: mileageLogTable.id })
        .from(mileageLogTable)
        .where(eq(mileageLogTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Mileage log not found" };
      }

      await dbPool.delete(mileageLogTable).where(eq(mileageLogTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get("/summary", async ({ query, set }) => {
    const { bookId, year } = query;

    if (!bookId || !year) {
      set.status = 400;
      return { error: "bookId and year are required" };
    }

    const yearNum = Number.parseInt(year, 10);

    const [result] = await dbPool
      .select({
        totalMiles: sql<string>`coalesce(sum(${mileageLogTable.distance}), 0)`,
        tripCount: sql<string>`count(*)`,
      })
      .from(mileageLogTable)
      .where(
        and(
          eq(mileageLogTable.bookId, bookId),
          like(mileageLogTable.date, `${yearNum}%`),
        ),
      );

    const totalMiles = Number(result?.totalMiles ?? 0);
    const tripCount = Number(result?.tripCount ?? 0);
    const ratePerMile = getMileageRate(yearNum);
    const deduction = totalMiles * ratePerMile;

    return {
      totalMiles: totalMiles.toFixed(1),
      tripCount,
      ratePerMile,
      deduction: deduction.toFixed(2),
      year: yearNum,
    };
  })
  .get("/vehicles", async ({ query, set }) => {
    const { bookId } = query;

    if (!bookId) {
      set.status = 400;
      return { error: "bookId is required" };
    }

    const vehicles = await dbPool
      .select()
      .from(vehicleTable)
      .where(eq(vehicleTable.bookId, bookId));

    return { vehicles };
  })
  .post(
    "/vehicles",
    async ({ body, set }) => {
      const [vehicle] = await dbPool
        .insert(vehicleTable)
        .values({
          bookId: body.bookId,
          name: body.name,
          year: body.year ?? null,
          make: body.make ?? null,
          model: body.model ?? null,
          dateInService: body.dateInService ?? null,
        })
        .returning();

      set.status = 201;

      return { vehicle };
    },
    {
      body: t.Object({
        bookId: t.String(),
        name: t.String(),
        year: t.Optional(t.Number()),
        make: t.Optional(t.String()),
        model: t.Optional(t.String()),
        dateInService: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/vehicles/:id",
    async ({ params, set }) => {
      const { id } = params;

      const [existing] = await dbPool
        .select({ id: vehicleTable.id })
        .from(vehicleTable)
        .where(eq(vehicleTable.id, id));

      if (!existing) {
        set.status = 404;
        return { error: "Vehicle not found" };
      }

      await dbPool.delete(vehicleTable).where(eq(vehicleTable.id, id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default mileageRoutes;
