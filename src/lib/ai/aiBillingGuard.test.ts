import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guard: myfi's managed AI is Posture C (AI included in the tier up to an
 * allowance the Synapse gateway enforces). Cost to credits, markup, the
 * allowance, and the ledger all live in the gateway and Aether, so myfi must
 * carry none of them, must expose no credit wallet, and must never call the
 * gateway with a shared key
 */

const SRC = join(import.meta.dir, "..", "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "generated" ? [] : sourceFiles(path);
    }
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

const offenders = (pattern: RegExp) =>
  files.filter((f) => pattern.test(f.text)).map((f) => f.path);

describe("AI billing guard (Posture C)", () => {
  test("no shared or static Synapse/provider key", () => {
    expect(offenders(/SYNAPSE_API_KEY|ANTHROPIC_API_KEY/)).toEqual([]);
  });

  test("no local markup, credit math, or per-model rate table", () => {
    expect(
      offenders(
        /creditsFromCostCents|estimateSynapseCostCents|DEFAULT_CREDIT_COGS_MARKUP|CENTS_PER_CREDIT|CentsPerMTok|costCents/,
      ),
    ).toEqual([]);
  });

  test("no local AI credit ledger or exposed wallet", () => {
    expect(
      offenders(
        /getCreditBalance|creditsFromBalanceUsd|deductCredits|addCredits|aiCredit|ai_credit|creditLedger|creditBalance/,
      ),
    ).toEqual([]);
  });

  test("every provisioner is product-scoped to myfi", () => {
    const provisioners = files.filter((f) =>
      /createSynapseProvisioner\(/.test(f.text),
    );
    expect(provisioners.map((f) => f.path)).toEqual(["lib/ai/synapse.ts"]);

    const [synapse] = provisioners;
    expect(synapse?.text).toContain("appId: MYFI_APP_ID");
    expect(synapse?.text).toContain('const MYFI_APP_ID = "myfi";');
  });

  test("gateway clients carry no default key", () => {
    const clientConfigs = files.flatMap((f) =>
      [...f.text.matchAll(/createSynapseClient\(\{[^}]*\}/g)].map((m) => m[0]),
    );
    expect(clientConfigs.length).toBeGreaterThan(0);
    for (const config of clientConfigs) {
      expect(config).not.toContain("apiKey");
    }
  });
});
