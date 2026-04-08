import type { ParsedTransaction } from "./importTransactions";

/**
 * Parse an OFX date string (YYYYMMDDHHMMSS or YYYYMMDD) to ISO
 */
const parseOfxDate = (ofxDate: string): string => {
  const cleaned = ofxDate.replace(/\[.*\]/, "").trim();
  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
};

/**
 * Extract a tag value from OFX SGML.
 * Handles both `<TAG>value` (SGML v1) and `<TAG>value</TAG>` (XML v2)
 */
const extractTag = (block: string, tag: string): string | null => {
  // Try XML-style first: <TAG>value</TAG>
  const xmlMatch = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  if (xmlMatch) return xmlMatch[1].trim();

  // SGML-style: <TAG>value\n (value ends at next tag or newline)
  const sgmlMatch = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
};

/**
 * Extract all transaction blocks from OFX content
 */
const extractTransactionBlocks = (content: string): string[] => {
  const blocks: string[] = [];
  const regex =
    /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST))/gi;
  let match = regex.exec(content);

  while (match !== null) {
    blocks.push(match[1]);
    match = regex.exec(content);
  }

  return blocks;
};

/**
 * Parse an OFX/QFX file content into transactions.
 * Handles both SGML (v1) and XML (v2) formats
 */
const parseOfx = (content: string): ParsedTransaction[] => {
  const blocks = extractTransactionBlocks(content);

  const transactions: ParsedTransaction[] = [];

  for (const block of blocks) {
    const amountStr = extractTag(block, "TRNAMT");
    const dateStr = extractTag(block, "DTPOSTED");
    const fitId = extractTag(block, "FITID");
    const name = extractTag(block, "NAME");
    const memo = extractTag(block, "MEMO");

    if (!amountStr || !dateStr) continue;

    const amount = Number.parseFloat(amountStr);
    if (Number.isNaN(amount) || amount === 0) continue;

    const description = name ?? memo ?? "OFX import";

    transactions.push({
      date: parseOfxDate(dateStr),
      // OFX: negative = debit/expense, positive = credit/income
      // Our convention: positive = expense, negative = income
      amount: -amount,
      memo: memo ? `${description} — ${memo}` : description,
      merchantName: name ?? null,
      referenceId: fitId ?? null,
    });
  }

  return transactions;
};

export default parseOfx;
