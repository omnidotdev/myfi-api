import { describe, expect, mock, test } from "bun:test";

import {
  SynapseProvisionError,
  SynapseRequestError,
} from "@omnidotdev/providers/ai";

import { aiFailureKind, createBookAi } from "./bookAi";

import type { BookAiDeps } from "./bookAi";

const ORG_ID = "0b6f2a3e-5c1d-4e8f-9a7b-1c2d3e4f5a6b";
const OWNER_ID = "7e1d2c3b-4a59-4687-8796-a5b4c3d2e1f0";
const ACTOR_ID = "3f2e1d0c-9b8a-4796-a5b4-c3d2e1f0a9b8";

const makeDeps = (overrides: Partial<BookAiDeps> = {}) => {
  const resolveKey = mock(async () => "sk-scoped");
  const lookupScope = mock(
    async (_bookId: string, actorId?: string) =>
      ({ keyHolderId: actorId ?? OWNER_ID, organizationId: ORG_ID }) as {
        keyHolderId: string;
        organizationId: string;
      } | null,
  );
  const info = mock(() => {});
  const warn = mock(() => {});

  const deps: BookAiDeps = {
    provisioner: { resolveKey },
    gatewayConfigured: true,
    lookupScope,
    log: { info, warn },
    ...overrides,
  };

  return { deps, resolveKey, lookupScope, info, warn };
};

describe("aiFailureKind", () => {
  test("402 from the gateway means the included allowance is used", () => {
    expect(aiFailureKind(new SynapseRequestError("x", 402))).toBe(
      "allowance_used",
    );
  });

  test("503, other statuses, and transport failures are unavailable", () => {
    expect(aiFailureKind(new SynapseRequestError("x", 503))).toBe(
      "unavailable",
    );
    expect(aiFailureKind(new SynapseProvisionError("x", 500))).toBe(
      "unavailable",
    );
    expect(aiFailureKind(new SynapseRequestError("x"))).toBe("unavailable");
    expect(aiFailureKind(new Error("boom"))).toBe("unavailable");
  });

  test("reads the status off an SDK error (Anthropic APIError shape)", () => {
    const err = Object.assign(new Error("payment required"), { status: 402 });
    expect(aiFailureKind(err)).toBe("allowance_used");
  });
});

describe("createBookAi", () => {
  test("bills the book's organization under the myfi product key", async () => {
    const { deps, resolveKey } = makeDeps();
    const bookAi = createBookAi(deps);

    const call = mock(async (apiKey: string) => `used ${apiKey}`);
    const outcome = await bookAi.run({ bookId: "book-1", mode: "bulk" }, call);

    expect(outcome).toEqual({ status: "ok", value: "used sk-scoped" });
    expect(resolveKey).toHaveBeenCalledWith(OWNER_ID, undefined, {
      entityType: "organization",
      entityId: ORG_ID,
    });
    expect(call).toHaveBeenCalledWith("sk-scoped");
  });

  test("mints the key under the acting user when one is present", async () => {
    const { deps, resolveKey, lookupScope } = makeDeps();
    const bookAi = createBookAi(deps);

    await bookAi.run(
      { bookId: "book-1", actorId: ACTOR_ID, mode: "interactive" },
      async () => null,
    );

    expect(lookupScope).toHaveBeenCalledWith("book-1", ACTOR_ID);
    expect(resolveKey).toHaveBeenCalledWith(ACTOR_ID, undefined, {
      entityType: "organization",
      entityId: ORG_ID,
    });
  });

  test("a gateway 402 degrades to allowance_used, logged at info, never retried", async () => {
    const { deps, info, warn } = makeDeps();
    const bookAi = createBookAi(deps);

    const call = mock(async () => {
      throw new SynapseRequestError("synapse request failed: status 402", 402);
    });
    const outcome = await bookAi.run({ bookId: "book-1", mode: "bulk" }, call);

    expect(outcome).toEqual({ status: "allowance_used" });
    expect(call).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a gateway 503 is unavailable", async () => {
    const { deps } = makeDeps();
    const bookAi = createBookAi(deps);

    const outcome = await bookAi.run(
      { bookId: "book-1", mode: "interactive" },
      async () => {
        throw new SynapseRequestError("x", 503);
      },
    );

    expect(outcome).toEqual({ status: "unavailable" });
  });

  test("a provisioning failure is unavailable and makes no gateway call", async () => {
    const { deps } = makeDeps({
      provisioner: {
        resolveKey: mock(async () => {
          throw new SynapseProvisionError("x", 500);
        }),
      },
    });
    const bookAi = createBookAi(deps);

    const call = mock(async () => "never");
    const outcome = await bookAi.run({ bookId: "book-1", mode: "bulk" }, call);

    expect(outcome).toEqual({ status: "unavailable" });
    expect(call).not.toHaveBeenCalled();
  });

  test("unconfigured Synapse is unavailable without touching the book", async () => {
    const { deps, lookupScope } = makeDeps({ provisioner: null });
    const bookAi = createBookAi(deps);

    const outcome = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      async () => "never",
    );

    expect(outcome).toEqual({ status: "unavailable" });
    expect(lookupScope).not.toHaveBeenCalled();
  });

  test("an unconfigured gateway is unavailable", async () => {
    const { deps, resolveKey } = makeDeps({ gatewayConfigured: false });
    const bookAi = createBookAi(deps);

    const outcome = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      async () => "never",
    );

    expect(outcome).toEqual({ status: "unavailable" });
    expect(resolveKey).not.toHaveBeenCalled();
  });

  test("a book with no billable scope is unavailable", async () => {
    const { deps, resolveKey } = makeDeps({
      lookupScope: mock(async () => null),
    });
    const bookAi = createBookAi(deps);

    const outcome = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      async () => "never",
    );

    expect(outcome).toEqual({ status: "unavailable" });
    expect(resolveKey).not.toHaveBeenCalled();
  });

  test("after a 402, bulk skips the gateway for the organization until the window passes", async () => {
    let nowMs = 1_000_000;
    const { deps, resolveKey } = makeDeps({ now: () => nowMs });
    const bookAi = createBookAi(deps);

    await bookAi.run({ bookId: "book-1", mode: "bulk" }, async () => {
      throw new SynapseRequestError("x", 402);
    });
    expect(resolveKey).toHaveBeenCalledTimes(1);

    const skipped = mock(async () => "never");
    const second = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      skipped,
    );
    expect(second).toEqual({ status: "allowance_used" });
    expect(skipped).not.toHaveBeenCalled();

    // Past the window the gateway is asked again
    nowMs += 60 * 60 * 1000;
    const retried = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      async () => "ok",
    );
    expect(retried).toEqual({ status: "ok", value: "ok" });
  });

  test("interactive calls always ask the gateway, and a success clears the bulk skip", async () => {
    const { deps } = makeDeps();
    const bookAi = createBookAi(deps);

    await bookAi.run({ bookId: "book-1", mode: "bulk" }, async () => {
      throw new SynapseRequestError("x", 402);
    });

    const interactive = await bookAi.run(
      { bookId: "book-1", mode: "interactive" },
      async () => "fresh",
    );
    expect(interactive).toEqual({ status: "ok", value: "fresh" });

    const bulk = await bookAi.run(
      { bookId: "book-1", mode: "bulk" },
      async () => "again",
    );
    expect(bulk).toEqual({ status: "ok", value: "again" });
  });
});
