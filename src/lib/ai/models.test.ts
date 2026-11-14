import { describe, expect, test } from "bun:test";

import {
  GATEWAY_DEFAULT_MODEL,
  INFER_MAX_TOKENS,
  inferModel,
  suggestModel,
} from "./models";

describe("categorization models", () => {
  test("default to the gateway's virtual default model", () => {
    expect(GATEWAY_DEFAULT_MODEL).toBe("auto");
    expect(inferModel({})).toBe("auto");
    expect(suggestModel({})).toBe("auto");
  });

  test("never pin a model id in code", () => {
    // The gateway's myfi policy owns the concrete model; a pinned id here
    // drifts from it and is refused once the policy moves on
    expect(inferModel({})).not.toContain("/");
    expect(suggestModel({})).not.toContain("/");
  });

  test("honor explicit env overrides", () => {
    expect(inferModel({ MYFI_INFER_MODEL: "anthropic/claude-haiku-5-5" })).toBe(
      "anthropic/claude-haiku-5-5",
    );
    expect(
      suggestModel({ MYFI_CATEGORIZATION_MODEL: "anthropic/claude-haiku-5-5" }),
    ).toBe("anthropic/claude-haiku-5-5");
  });

  test("treat an empty override as unset", () => {
    expect(inferModel({ MYFI_INFER_MODEL: "" })).toBe("auto");
    expect(suggestModel({ MYFI_CATEGORIZATION_MODEL: " " })).toBe("auto");
  });

  test("leave room for thinking before the JSON answer", () => {
    // Current models think by default and thinking counts toward max_tokens
    expect(INFER_MAX_TOKENS).toBeGreaterThanOrEqual(1024);
  });
});
