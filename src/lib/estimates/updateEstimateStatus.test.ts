import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { updateEstimateStatus } = await import("./updateEstimateStatus");

const sentEstimate = {
  id: "est-1",
  bookId: "book-1",
  status: "sent",
};

beforeEach(() => {
  resetDbMock();
});

describe("updateEstimateStatus", () => {
  test("transitions an estimate to accepted", async () => {
    setSelectResults([[sentEstimate]]);
    const result = await updateEstimateStatus("est-1", "book-1", "accepted");
    expect(result).toEqual({ estimateId: "est-1", status: "accepted" });
  });

  test("rejects an invalid status", async () => {
    await expect(
      // @ts-expect-error testing runtime guard on a bad status
      updateEstimateStatus("est-1", "book-1", "bogus"),
    ).rejects.toThrow(/Invalid/);
  });

  test("refuses to change a converted estimate", async () => {
    setSelectResults([[{ ...sentEstimate, status: "converted" }]]);
    await expect(
      updateEstimateStatus("est-1", "book-1", "declined"),
    ).rejects.toThrow(/converted/);
  });

  test("rejects a cross-book estimate (IDOR)", async () => {
    setSelectResults([[{ ...sentEstimate, bookId: "other" }]]);
    await expect(
      updateEstimateStatus("est-1", "book-1", "accepted"),
    ).rejects.toThrow(/not found/);
  });
});
