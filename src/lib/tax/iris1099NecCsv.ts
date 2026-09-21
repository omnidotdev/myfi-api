/**
 * Build a CSV of 1099-NEC forms for upload to the free IRS IRIS (Information
 * Returns Intake System) Taxpayer Portal, so filers can e-file without a paid
 * provider.
 *
 * NOTE: verify these column headers against the current IRIS 1099-NEC CSV
 * template downloaded from the IRIS portal before filing. The IRS may adjust the
 * template between tax years; IRIS also validates the file on upload and lets you
 * review each record before submitting.
 */

type Form1099NecRecord = {
  recipientName: string;
  recipientTin: string | null;
  recipientTinType: string | null;
  recipientAddress: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  box1NonemployeeCompensation: string;
};

type IrisReport = {
  year: number;
  forms: Form1099NecRecord[];
};

type PayerInfo = {
  ein: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
};

const HEADERS = [
  "Tax Year",
  "Payer TIN",
  "Payer Name",
  "Payer Address",
  "Payer City",
  "Payer State",
  "Payer ZIP",
  "Payer Phone",
  "Recipient TIN",
  "Recipient TIN Type",
  "Recipient Name",
  "Recipient Address",
  "Recipient City",
  "Recipient State",
  "Recipient ZIP",
  "Box 1 Nonemployee Compensation",
  "Box 4 Federal Income Tax Withheld",
];

/** Quote a field when it contains a comma, quote, or newline; empty for nullish. */
const csvField = (value: string | null | undefined): string => {
  if (value == null) return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const tinTypeIndicator = (type: string | null): string => {
  if (type === "ein") return "EIN";
  if (type === "ssn") return "SSN";
  return "";
};

const generate1099NecIrisCsv = (
  report: IrisReport,
  payer: PayerInfo,
): string => {
  const lines = [HEADERS.map(csvField).join(",")];

  for (const f of report.forms) {
    const cells = [
      String(report.year),
      payer.ein,
      payer.name,
      payer.address,
      payer.city,
      payer.state,
      payer.zip,
      payer.phone,
      f.recipientTin,
      tinTypeIndicator(f.recipientTinType),
      f.recipientName,
      f.recipientAddress.address,
      f.recipientAddress.city,
      f.recipientAddress.state,
      f.recipientAddress.zip,
      f.box1NonemployeeCompensation,
      // no backup withholding tracked; IRIS still expects the box
      "0.00",
    ];
    lines.push(cells.map(csvField).join(","));
  }

  return `${lines.join("\n")}\n`;
};

export default generate1099NecIrisCsv;
