import { describe, expect, test } from "bun:test";

import { previewCsv, previewOfx } from "./previewImport";

describe("previewCsv", () => {
  test("auto-detects columns and returns preview rows", () => {
    const csv = [
      "Date,Description,Amount",
      "03/15/2026,Grocery Store,-45.00",
      "03/16/2026,Direct Deposit,2500.00",
    ].join("\n");

    const result = previewCsv(csv);

    expect(result.headers).toEqual(["Date", "Description", "Amount"]);
    expect(result.columnMap).toEqual({ date: 0, memo: 1, amount: 2 });
    expect(result.sampleRows).toHaveLength(2);
    expect(result.sampleRows[0]).toEqual([
      "03/15/2026",
      "Grocery Store",
      "-45.00",
    ]);
    expect(result.totalRows).toBe(2);
    expect(result.autoDetected).toBe(true);
  });

  test("returns null columnMap when auto-detect fails", () => {
    const csv = ["Foo,Bar,Baz", "2026-03-15,Something,100"].join("\n");
    const result = previewCsv(csv);

    expect(result.headers).toEqual(["Foo", "Bar", "Baz"]);
    expect(result.columnMap).toBeNull();
    expect(result.autoDetected).toBe(false);
    expect(result.sampleRows).toHaveLength(1);
  });

  test("applies custom columnMap override", () => {
    const csv = ["Foo,Bar,Baz", "2026-03-15,Something,100"].join("\n");
    const result = previewCsv(csv, { date: 0, memo: 1, amount: 2 });

    expect(result.columnMap).toEqual({ date: 0, memo: 1, amount: 2 });
    expect(result.autoDetected).toBe(false);
  });

  test("limits sample rows to 10", () => {
    const lines = ["Date,Description,Amount"];
    for (let i = 0; i < 50; i++) {
      lines.push(
        `03/${String(i + 1).padStart(2, "0")}/2026,Store ${i},${i}.00`,
      );
    }

    const result = previewCsv(lines.join("\n"));
    expect(result.sampleRows).toHaveLength(10);
    expect(result.totalRows).toBe(50);
  });
});

describe("previewOfx", () => {
  test("parses OFX and returns preview", () => {
    const ofx = `
OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNAMT>-45.00
<DTPOSTED>20260315
<FITID>ABC123
<NAME>Grocery Store
</STMTTRN>
<STMTTRN>
<TRNAMT>2500.00
<DTPOSTED>20260316
<FITID>DEF456
<NAME>Direct Deposit
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = previewOfx(ofx);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].merchantName).toBe("Grocery Store");
    expect(result.transactions[0].amount).toBe(45);
    expect(result.transactions[0].referenceId).toBe("ABC123");
    expect(result.totalRows).toBe(2);
  });
});
