import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const ACTOR_ID = "3f2e1d0c-9b8a-4796-a5b4-c3d2e1f0a9b8";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

mock.module("lib/ai/synapse", () => ({
  SYNAPSE_BASE_URL: "https://gateway.test",
  synapseProvisioner: { resolveKey: async () => "unused" },
}));

type Outcome =
  | { status: "ok"; value: unknown }
  | { status: "allowance_used" }
  | { status: "unavailable" };
const mockRun = mock(
  async (
    _req: unknown,
    call: (apiKey: string) => Promise<unknown>,
  ): Promise<Outcome> => ({ status: "ok", value: await call("sk-scoped") }),
);
mock.module("lib/ai/bookAi", () => ({ default: { run: mockRun } }));

const anthropicOptions: unknown[] = [];
const mockCreate = mock(async () => ({
  content: [
    {
      type: "tool_use",
      input: {
        debitAccountId: "a1",
        creditAccountId: "a2",
        confidence: 0.9,
        rationale: "Office purchase",
      },
    },
  ],
}));
mock.module("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
    constructor(options: unknown) {
      anthropicOptions.push(options);
    }
  },
}));

const { suggestCategory } = await import("./suggestCategory");

const accounts = [
  { id: "a1", code: "6000", name: "Office", type: "expense", subType: null },
  { id: "a2", code: "1000", name: "Checking", type: "asset", subType: null },
];
const txn = { description: "Staples", amount: 42.5, date: "2026-03-01" };

describe("suggestCategory scoping", () => {
  beforeEach(() => {
    resetDbMock();
    mockRun.mockClear();
    mockCreate.mockClear();
    anthropicOptions.length = 0;
  });

  test("runs interactively for the book under the acting user, through the gateway with the scoped key", async () => {
    setSelectResults([accounts]);

    const outcome = await suggestCategory("book-1", txn, ACTOR_ID);

    expect(mockRun.mock.calls[0]?.[0]).toEqual({
      bookId: "book-1",
      actorId: ACTOR_ID,
      mode: "interactive",
    });
    expect(anthropicOptions).toEqual([
      { apiKey: "sk-scoped", baseURL: "https://gateway.test" },
    ]);
    expect(outcome.status).toBe("ok");
  });

  test("passes the allowance-used state through", async () => {
    setSelectResults([accounts]);
    mockRun.mockResolvedValueOnce({ status: "allowance_used" });

    const outcome = await suggestCategory("book-1", txn, ACTOR_ID);

    expect(outcome).toEqual({ status: "allowance_used" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("a book with no accounts has no suggestion and makes no AI call", async () => {
    setSelectResults([[]]);

    const outcome = await suggestCategory("book-1", txn, ACTOR_ID);

    expect(outcome).toEqual({ status: "ok", value: null });
    expect(mockRun).not.toHaveBeenCalled();
  });
});
