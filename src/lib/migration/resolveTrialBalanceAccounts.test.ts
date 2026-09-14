import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { resolveTrialBalanceAccounts, matchAccount } = await import(
  "./resolveTrialBalanceAccounts"
);

const chart = [
  { id: "acct-cash", code: "1000", name: "Checking" },
  { id: "acct-ar", code: null, name: "Accounts Receivable" },
  { id: "acct-ap", code: null, name: "Accounts Payable" },
  { id: "acct-dup-a", code: null, name: "Consulting" },
  { id: "acct-dup-b", code: null, name: "Consulting" },
];

beforeEach(() => resetDbMock());

describe("matchAccount", () => {
  test("matches on a unique account number/code", () => {
    expect(
      matchAccount(
        { name: "Whatever", accountNum: "1000", debit: 1, credit: 0 },
        chart,
      ),
    ).toBe("acct-cash");
  });

  test("matches on a unique case-insensitive name", () => {
    expect(
      matchAccount({ name: "accounts payable", debit: 0, credit: 1 }, chart),
    ).toBe("acct-ap");
  });

  test("leaves an ambiguous name unmatched", () => {
    expect(
      matchAccount({ name: "Consulting", debit: 0, credit: 1 }, chart),
    ).toBeNull();
  });

  test("leaves an unknown account unmatched", () => {
    expect(
      matchAccount({ name: "Mystery Account", debit: 1, credit: 0 }, chart),
    ).toBeNull();
  });
});

describe("resolveTrialBalanceAccounts", () => {
  test("partitions parsed accounts into mapped and unmatched", async () => {
    setSelectResults([chart]);

    const { mapped, unmatched } = await resolveTrialBalanceAccounts({
      bookId: "book-1",
      parsed: {
        accounts: [
          { name: "Checking", accountNum: "1000", debit: 12500, credit: 0 },
          { name: "Accounts Payable", debit: 0, credit: 1700 },
          { name: "Mystery Account", debit: 300, credit: 0 },
        ],
      },
    });

    expect(mapped).toEqual([
      { accountId: "acct-cash", debit: 12500, credit: 0, name: "Checking" },
      {
        accountId: "acct-ap",
        debit: 0,
        credit: 1700,
        name: "Accounts Payable",
      },
    ]);
    expect(unmatched.map((a) => a.name)).toEqual(["Mystery Account"]);
  });
});
