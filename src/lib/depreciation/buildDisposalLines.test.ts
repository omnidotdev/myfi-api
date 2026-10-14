import { describe, expect, test } from "bun:test";

import { validateJournalLines } from "lib/journal/validateEntry";
import { buildDisposalLines } from "./buildDisposalLines";

const accounts = {
  assetAccountId: "asset",
  accumulatedDepreciationAccountId: "accum",
  proceedsAccountId: "cash",
  gainLossAccountId: "gainloss",
};

describe("buildDisposalLines", () => {
  test("gain on disposal balances (proceeds above book value)", () => {
    const lines = buildDisposalLines({
      acquisitionCost: "1000",
      totalDepreciated: "400",
      proceeds: "700",
      ...accounts,
    });
    expect(() => validateJournalLines(lines)).not.toThrow();
    const gain = lines.find((l) => l.accountId === "gainloss");
    expect(gain?.credit).toBe("100.0000");
    expect(gain?.debit).toBe("0");
  });

  test("loss on disposal balances (proceeds below book value)", () => {
    const lines = buildDisposalLines({
      acquisitionCost: "1000",
      totalDepreciated: "400",
      proceeds: "500",
      ...accounts,
    });
    expect(() => validateJournalLines(lines)).not.toThrow();
    const loss = lines.find((l) => l.accountId === "gainloss");
    expect(loss?.debit).toBe("100.0000");
  });

  test("a sub-cent residual still balances instead of being dropped", () => {
    // cost 100, depreciated 99.9999 -> book value 0.0001, sold for 0.
    // The old code dropped the 0.0001 loss (materiality threshold) and posted
    // an unbalanced entry; the residual must be absorbed exactly.
    const lines = buildDisposalLines({
      acquisitionCost: "100.0000",
      totalDepreciated: "99.9999",
      proceeds: "0",
      ...accounts,
    });
    expect(() => validateJournalLines(lines)).not.toThrow();
    // Zero-proceeds line is omitted (the validator rejects zero lines)
    expect(lines.some((l) => l.accountId === "cash")).toBe(false);
    const loss = lines.find((l) => l.accountId === "gainloss");
    expect(loss?.debit).toBe("0.0001");
  });

  test("break-even disposal emits no gain/loss line", () => {
    const lines = buildDisposalLines({
      acquisitionCost: "1000",
      totalDepreciated: "0",
      proceeds: "1000",
      ...accounts,
    });
    expect(() => validateJournalLines(lines)).not.toThrow();
    expect(lines.some((l) => l.accountId === "gainloss")).toBe(false);
    expect(lines).toHaveLength(2);
  });

  test("proceeds with sub-cent precision round consistently and still balance", () => {
    const lines = buildDisposalLines({
      acquisitionCost: "100",
      totalDepreciated: "0",
      proceeds: "100.12345",
      ...accounts,
    });
    expect(() => validateJournalLines(lines)).not.toThrow();
    const proceeds = lines.find((l) => l.accountId === "cash");
    const gain = lines.find((l) => l.accountId === "gainloss");
    expect(proceeds?.debit).toBe("100.1235");
    expect(gain?.credit).toBe("0.1235");
  });
});
