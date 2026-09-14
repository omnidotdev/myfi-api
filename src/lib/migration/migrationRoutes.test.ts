import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mockDbPool,
  resetDbMock,
  setInsertReturningData,
  setSelectResults,
} from "lib/test/mockDb";

// Capture writes made inside the import transaction
const insertedLines: Array<Record<string, unknown>> = [];
let entrySeq = 0;

const txInsertValues = mock((values: Record<string, unknown>) => {
  if (values.source !== undefined) {
    return { returning: mock(() => [{ id: `entry-${++entrySeq}` }]) };
  }
  insertedLines.push(values);
  return {};
});

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    insert: mock(() => ({ values: txInsertValues })),
    delete: mock(() => ({
      where: mock(() => ({ returning: mock(() => []) })),
    })),
  };
  return await fn(tx);
});

mock.module("lib/db/db", () => ({
  dbPool: { ...mockDbPool, transaction: mockTransaction },
}));

const migrationRoutes = (await import("./migrationRoutes")).default;
const app = migrationRoutes;

const CHART = [
  { id: "acct-cash", code: "1000", name: "Checking" },
  { id: "acct-ap", code: null, name: "Accounts Payable" },
  { id: "acct-eq", code: null, name: "Opening Balance Equity" },
];

const TB_CSV = `Omni LLC
Trial Balance
"As of August 31, 2026"
,Debit,Credit
1000 Checking,"10,000.00",
Accounts Payable,,"1,000.00"
Opening Balance Equity,,"9,000.00"
TOTAL,"10,000.00","10,000.00"
`;

const upload = (path: string, fields: Record<string, string>, csv = TB_CSV) => {
  const form = new FormData();
  form.append("file", new File([csv], "tb.csv", { type: "text/csv" }));
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return app.handle(
    new Request(`http://localhost${path}`, { method: "POST", body: form }),
  );
};

beforeEach(() => {
  resetDbMock();
  insertedLines.length = 0;
  entrySeq = 0;
  txInsertValues.mockClear();
  mockTransaction.mockClear();
});

describe("POST /api/migration/opening-balances/preview", () => {
  test("parses and auto-matches against the chart", async () => {
    setSelectResults([CHART]);

    const res = await upload("/api/migration/opening-balances/preview", {
      bookId: "book-1",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.asOf).toBe("August 31, 2026");
    expect(body.balances).toBe(true);
    expect(body.matched).toHaveLength(3);
    expect(body.toCreate).toHaveLength(0);
  });

  test("flags accounts that will be created, with an inferred type", async () => {
    // Chart missing Accounts Payable -> it will be created on import
    setSelectResults([[CHART[0], CHART[2]]]);

    const res = await upload("/api/migration/opening-balances/preview", {
      bookId: "book-1",
    });
    const body = await res.json();

    expect(body.toCreate).toHaveLength(1);
    expect(body.toCreate[0]).toMatchObject({
      name: "Accounts Payable",
      type: "liability",
    });
  });
});

describe("POST /api/migration/opening-balances", () => {
  test("imports a fully-matched trial balance", async () => {
    setSelectResults([CHART]);

    const res = await upload("/api/migration/opening-balances", {
      bookId: "book-1",
      asOf: "2026-08-31",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      imported: 3,
      replaced: false,
      asOf: "2026-08-31",
    });
    expect(insertedLines).toHaveLength(3);
  });

  test("rejects a bad as-of date", async () => {
    setSelectResults([CHART]);

    const res = await upload("/api/migration/opening-balances", {
      bookId: "book-1",
      asOf: "Aug 31 2026",
    });

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test("creates missing accounts, then imports", async () => {
    // Chart missing Accounts Payable -> it is created (mirroring QuickBooks)
    setSelectResults([[CHART[0], CHART[2]]]);
    setInsertReturningData([{ id: "acct-ap-new" }]);

    const res = await upload("/api/migration/opening-balances", {
      bookId: "book-1",
      asOf: "2026-08-31",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ imported: 3, created: 1 });
  });

  test("resolves an unmatched account via a manual mapping", async () => {
    setSelectResults([[CHART[0], CHART[2]]]);

    const res = await upload("/api/migration/opening-balances", {
      bookId: "book-1",
      asOf: "2026-08-31",
      mappings: JSON.stringify({ "Accounts Payable": "acct-ap" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(3);
  });
});
