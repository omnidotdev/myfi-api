import { describe, expect, test } from "bun:test";

import generate1099NecIrisCsv from "./iris1099NecCsv";

const payer = {
  ein: "12-3456789",
  name: "Omni LLC",
  address: "1 Main St",
  city: "Wilmington",
  state: "DE",
  zip: "19801",
  phone: "3025551234",
};

const form = (over: Record<string, unknown> = {}) => ({
  vendorId: "v1",
  recipientName: "Jane Contractor",
  recipientTin: "98-7654321",
  recipientTinType: "ein",
  recipientAddress: {
    address: "2 Oak Ave",
    city: "Austin",
    state: "TX",
    zip: "78701",
  },
  box1NonemployeeCompensation: "1500.00",
  ...over,
});

const rows = (csv: string) => csv.trim().split("\n");

describe("generate1099NecIrisCsv", () => {
  test("emits a header row plus one row per form", () => {
    const csv = generate1099NecIrisCsv(
      { year: 2025, forms: [form(), form()] },
      payer,
    );
    expect(rows(csv).length).toBe(3); // header + 2 data rows
  });

  test("emits only the header row when there are no forms", () => {
    const csv = generate1099NecIrisCsv({ year: 2025, forms: [] }, payer);
    expect(rows(csv).length).toBe(1);
  });

  test("includes payer, recipient and box 1 amount in a data row", () => {
    const csv = generate1099NecIrisCsv({ year: 2025, forms: [form()] }, payer);
    const dataRow = rows(csv)[1];
    expect(dataRow).toContain("12-3456789"); // payer EIN
    expect(dataRow).toContain("Omni LLC"); // payer name
    expect(dataRow).toContain("98-7654321"); // recipient TIN
    expect(dataRow).toContain("Jane Contractor"); // recipient name
    expect(dataRow).toContain("1500.00"); // box 1
    expect(dataRow).toContain("2025"); // tax year
  });

  test("quotes fields that contain a comma", () => {
    const csv = generate1099NecIrisCsv(
      { year: 2025, forms: [form({ recipientName: "Acme, Inc." })] },
      payer,
    );
    expect(csv).toContain('"Acme, Inc."');
  });

  test("escapes embedded double quotes by doubling them", () => {
    const csv = generate1099NecIrisCsv(
      { year: 2025, forms: [form({ recipientName: 'Bob "The Builder"' })] },
      payer,
    );
    expect(csv).toContain('"Bob ""The Builder"""');
  });

  test("renders a missing recipient TIN as an empty field, not the word null", () => {
    const csv = generate1099NecIrisCsv(
      { year: 2025, forms: [form({ recipientTin: null })] },
      payer,
    );
    expect(csv.toLowerCase()).not.toContain("null");
  });

  test("maps the recipient TIN type to an IRIS indicator", () => {
    const ein = generate1099NecIrisCsv(
      { year: 2025, forms: [form({ recipientTinType: "ein" })] },
      payer,
    );
    const ssn = generate1099NecIrisCsv(
      { year: 2025, forms: [form({ recipientTinType: "ssn" })] },
      payer,
    );
    expect(rows(ein)[1]).toContain("EIN");
    expect(rows(ssn)[1]).toContain("SSN");
  });
});
