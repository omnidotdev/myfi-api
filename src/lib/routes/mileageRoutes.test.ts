import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  mockDeleteWhere,
  mockInsertValues,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: mileageRoutes } = await import("./mileageRoutes");

const app = mileageRoutes;

const makeVehicle = (overrides: Record<string, unknown> = {}) => ({
  id: "v-1",
  bookId: "book-1",
  name: "Work Truck",
  year: 2023,
  make: "Ford",
  model: "F-150",
  dateInService: "2023-06-01",
  createdAt: "2026-01-01",
  ...overrides,
});

const makeLog = (overrides: Record<string, unknown> = {}) => ({
  id: "ml-1",
  bookId: "book-1",
  vehicleId: "v-1",
  date: "2026-03-15",
  description: "Client meeting",
  origin: "Office",
  destination: "Client HQ",
  odometerStart: null,
  odometerEnd: null,
  distance: "25.0",
  isRoundTrip: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  vehicleName: "Work Truck",
  ...overrides,
});

describe("POST /api/mileage/vehicles", () => {
  beforeEach(() => resetDbMock());

  test("creates a vehicle", async () => {
    const vehicle = makeVehicle();
    setInsertReturningData([vehicle]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          name: "Work Truck",
          year: 2023,
          make: "Ford",
          model: "F-150",
          dateInService: "2023-06-01",
        }),
      }),
    );

    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.vehicle.name).toBe("Work Truck");
    expect(mockInsertValues).toHaveBeenCalled();
  });
});

describe("DELETE /api/mileage/vehicles/:id", () => {
  beforeEach(() => resetDbMock());

  test("returns 404 when vehicle not found", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage/vehicles/missing", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Vehicle not found");
  });

  test("deletes an existing vehicle", async () => {
    setSelectResults([[{ id: "v-1" }]]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage/vehicles/v-1", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});

describe("POST /api/mileage", () => {
  beforeEach(() => resetDbMock());

  test("creates a mileage log entry", async () => {
    const log = makeLog();
    setInsertReturningData([log]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          vehicleId: "v-1",
          date: "2026-03-15",
          description: "Client meeting",
          origin: "Office",
          destination: "Client HQ",
          distance: "25.0",
        }),
      }),
    );

    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.log.distance).toBe("25.0");
  });

  test("doubles distance for round trips", async () => {
    const log = makeLog({ distance: "50.0", isRoundTrip: true });
    setInsertReturningData([log]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: "book-1",
          vehicleId: "v-1",
          date: "2026-03-15",
          distance: "25.0",
          isRoundTrip: true,
        }),
      }),
    );

    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.log.isRoundTrip).toBe(true);
    expect(mockInsertValues).toHaveBeenCalled();
  });
});

describe("DELETE /api/mileage/:id", () => {
  beforeEach(() => resetDbMock());

  test("returns 404 when log not found", async () => {
    setSelectResults([[]]);

    const res = await app.handle(
      new Request("http://localhost/api/mileage/missing", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Mileage log not found");
  });
});
