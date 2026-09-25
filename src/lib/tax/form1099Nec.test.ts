import { beforeEach, describe, expect, mock, test } from "bun:test";

import { mockDbPool, resetDbMock, setSelectResults } from "lib/test/mockDb";

const mockDecryptToken = mock((val: string) => val);
mock.module("lib/encryption/tokenEncryption", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: mock((val: string) => val),
}));
mock.module("lib/db/db", () => ({ dbPool: mockDbPool }));

const { default: generate1099Nec, maskForm1099NecReport } = await import(
  "./form1099Nec"
);

const makeVendor = (overrides: Record<string, unknown> = {}) => ({
  id: "vendor-1",
  bookId: "book-1",
  name: "Jane Doe",
  businessName: null,
  taxIdType: "ssn",
  taxId: "encrypted-tin",
  address: "123 Main St",
  city: "Springfield",
  state: "IL",
  zip: "62704",
  email: "jane@example.com",
  is1099Eligible: true,
  threshold: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("generate1099Nec", () => {
  beforeEach(() => {
    resetDbMock();
    mockDecryptToken.mockClear();
    mockDecryptToken.mockImplementation((val: string) => val);
  });

  test("generates 1099 for vendor above threshold", async () => {
    setSelectResults([[makeVendor()], [{ total: "1000.00" }]]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.totalForms).toBe(1);
    expect(result.forms[0].box1NonemployeeCompensation).toBe("1000.00");
    expect(result.forms[0].recipientName).toBe("Jane Doe");
    expect(result.year).toBe(2025);
  });

  test("excludes vendor below threshold", async () => {
    setSelectResults([[makeVendor()], [{ total: "500.00" }]]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.totalForms).toBe(0);
    expect(result.forms).toEqual([]);
  });

  test("uses custom vendor threshold", async () => {
    setSelectResults([
      [makeVendor({ threshold: "1000.0000" })],
      [{ total: "800.00" }],
    ]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.totalForms).toBe(0);
    expect(result.forms).toEqual([]);
  });

  test("decrypts TIN for form data", async () => {
    mockDecryptToken.mockImplementation(() => "123-45-6789");

    setSelectResults([[makeVendor()], [{ total: "700.00" }]]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(mockDecryptToken).toHaveBeenCalledWith("encrypted-tin");
    expect(result.forms[0].recipientTin).toBe("123-45-6789");
  });

  test("excludes non-eligible vendors", async () => {
    // DB returns empty because the query filters by is1099Eligible
    setSelectResults([[]]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.totalForms).toBe(0);
    expect(result.forms).toEqual([]);
    expect(result.totalAmount).toBe("0.00");
  });

  test("handles missing TIN gracefully", async () => {
    setSelectResults([[makeVendor({ taxId: null })], [{ total: "600.00" }]]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.totalForms).toBe(1);
    expect(result.forms[0].recipientTin).toBeNull();
    expect(mockDecryptToken).not.toHaveBeenCalled();
  });

  test("uses businessName when available", async () => {
    setSelectResults([
      [makeVendor({ businessName: "Doe Consulting LLC" })],
      [{ total: "1500.00" }],
    ]);

    const result = await generate1099Nec({ bookId: "book-1", year: 2025 });

    expect(result.forms[0].recipientName).toBe("Doe Consulting LLC");
  });
});

describe("maskForm1099NecReport", () => {
  const makeReport = (
    forms: Array<{
      recipientTin: string | null;
      recipientTinType: string | null;
    }>,
  ) => ({
    year: 2025,
    totalForms: forms.length,
    totalAmount: "1000.00",
    generatedAt: "2026-01-01T00:00:00.000Z",
    forms: forms.map((f, i) => ({
      vendorId: `vendor-${i}`,
      recipientName: "Jane Doe",
      recipientTin: f.recipientTin,
      recipientTinType: f.recipientTinType,
      recipientAddress: {
        address: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62704",
      },
      box1NonemployeeCompensation: "1000.00",
    })),
  });

  test("masks an SSN to last four digits", () => {
    const masked = maskForm1099NecReport(
      makeReport([{ recipientTin: "123-45-6789", recipientTinType: "ssn" }]),
    );

    expect(masked.forms[0].recipientTin).toBe("***-**-6789");
  });

  test("masks an EIN to last four digits", () => {
    const masked = maskForm1099NecReport(
      makeReport([{ recipientTin: "98-7654321", recipientTinType: "ein" }]),
    );

    expect(masked.forms[0].recipientTin).toBe("**-***4321");
  });

  test("masks an unknown TIN type to last four digits", () => {
    const masked = maskForm1099NecReport(
      makeReport([{ recipientTin: "555112222", recipientTinType: null }]),
    );

    expect(masked.forms[0].recipientTin).toBe("****2222");
  });

  test("leaves a missing TIN as null", () => {
    const masked = maskForm1099NecReport(
      makeReport([{ recipientTin: null, recipientTinType: "ssn" }]),
    );

    expect(masked.forms[0].recipientTin).toBeNull();
  });

  test("preserves all non-TIN fields", () => {
    const report = makeReport([
      { recipientTin: "123-45-6789", recipientTinType: "ssn" },
    ]);
    const masked = maskForm1099NecReport(report);

    expect(masked.year).toBe(2025);
    expect(masked.totalForms).toBe(1);
    expect(masked.totalAmount).toBe("1000.00");
    expect(masked.forms[0].recipientName).toBe("Jane Doe");
    expect(masked.forms[0].box1NonemployeeCompensation).toBe("1000.00");
    expect(masked.forms[0].recipientAddress.zip).toBe("62704");
  });

  test("does not mutate the input report", () => {
    const report = makeReport([
      { recipientTin: "123-45-6789", recipientTinType: "ssn" },
    ]);
    maskForm1099NecReport(report);

    expect(report.forms[0].recipientTin).toBe("123-45-6789");
  });
});
