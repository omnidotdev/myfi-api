import { describe, expect, test } from "bun:test";

import { ITEM_TYPES, isValidItemType, resolveItemAccounts } from "./itemType";

describe("isValidItemType", () => {
  test("accepts the known item types", () => {
    for (const t of ITEM_TYPES) {
      expect(isValidItemType(t)).toBe(true);
    }
  });

  test("rejects anything else", () => {
    expect(isValidItemType("widget")).toBe(false);
    expect(isValidItemType("")).toBe(false);
  });
});

describe("resolveItemAccounts", () => {
  test("inventory items require both an asset and a COGS account", () => {
    expect(() =>
      resolveItemAccounts("inventory", { assetAccountId: "a" }),
    ).toThrow(/asset account and a COGS account/i);
    expect(() =>
      resolveItemAccounts("inventory", { cogsAccountId: "c" }),
    ).toThrow(/asset account and a COGS account/i);
    expect(
      resolveItemAccounts("inventory", {
        assetAccountId: "a",
        cogsAccountId: "c",
      }),
    ).toEqual({ assetAccountId: "a", cogsAccountId: "c" });
  });

  test("service items carry no asset/COGS accounts even if supplied", () => {
    expect(
      resolveItemAccounts("service", {
        assetAccountId: "a",
        cogsAccountId: "c",
      }),
    ).toEqual({ assetAccountId: null, cogsAccountId: null });
  });

  test("non-inventory items carry no asset/COGS accounts", () => {
    expect(resolveItemAccounts("non_inventory", {})).toEqual({
      assetAccountId: null,
      cogsAccountId: null,
    });
  });
});
