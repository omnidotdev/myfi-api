import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockEmit = mock(() =>
  Promise.resolve({ eventId: "test-1", timestamp: "2026-01-01" }),
);

mock.module("lib/providers", () => ({
  events: { emit: mockEmit },
}));

const { emitAudit, SYSTEM_ACTOR } = await import("./auditEmitter");

const baseEvent = {
  type: "myfi.test.created",
  organizationId: "org-123",
  actor: { id: "user-1", name: "Test User", email: "test@example.com" },
  resource: { type: "test", id: "res-1", name: "Test Resource" },
};

const getEmitArg = () =>
  (mockEmit.mock.calls[0] as unknown[])[0] as Record<string, unknown>;

const getEmitData = () =>
  (getEmitArg().data ?? {}) as Record<string, unknown>;

describe("emitAudit", () => {
  beforeEach(() => {
    mockEmit.mockClear();
  });

  test("emits event with correct type", async () => {
    emitAudit(baseEvent);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(getEmitArg().type).toBe("myfi.test.created");
  });

  test("includes organizationId", async () => {
    emitAudit(baseEvent);
    await new Promise((r) => setTimeout(r, 10));

    expect(getEmitArg().organizationId).toBe("org-123");
  });

  test("includes actor info in data", async () => {
    emitAudit(baseEvent);
    await new Promise((r) => setTimeout(r, 10));

    const data = getEmitData();
    expect(data.actorId).toBe("user-1");
    expect(data.actorName).toBe("Test User");
    expect(data.actorEmail).toBe("test@example.com");
  });

  test("includes resource info in data", async () => {
    emitAudit(baseEvent);
    await new Promise((r) => setTimeout(r, 10));

    const data = getEmitData();
    expect(data.resourceType).toBe("test");
    expect(data.resourceId).toBe("res-1");
    expect(data.resourceName).toBe("Test Resource");
  });

  test("includes custom data fields", async () => {
    emitAudit({ ...baseEvent, data: { extra: "value", count: 42 } });
    await new Promise((r) => setTimeout(r, 10));

    const data = getEmitData();
    expect(data.extra).toBe("value");
    expect(data.count).toBe(42);
  });

  test("sets subject to resource id", async () => {
    emitAudit(baseEvent);
    await new Promise((r) => setTimeout(r, 10));

    expect(getEmitArg().subject).toBe("res-1");
  });

  test("does not throw on emit failure", () => {
    mockEmit.mockImplementationOnce(() =>
      Promise.reject(new Error("network error")),
    );

    expect(() => emitAudit(baseEvent)).not.toThrow();
  });
});

describe("SYSTEM_ACTOR", () => {
  test("has correct shape", () => {
    expect(SYSTEM_ACTOR).toEqual({
      id: "system",
      name: "MyFi System",
    });
  });
});
