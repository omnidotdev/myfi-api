// Money is validated as integer ten-thousandths to match the numeric(19,4)
// ledger columns, so the balance check is exact (no binary-float drift)
const MONEY_SCALE = 10000;

const toUnits = (raw: string | undefined): number =>
  Math.round((Number.parseFloat(raw ?? "0") || 0) * MONEY_SCALE);

interface JournalLineInput {
  debit?: string;
  credit?: string;
}

/**
 * Validate that a set of journal lines forms a well-formed, balanced entry, the
 * core invariant of double-entry bookkeeping. Throws an Error (message safe to
 * surface) when invalid. Enforced server-side so the ledger cannot be corrupted
 * by a client that skips the check or a direct API call.
 *
 * Rules: at least two lines; every amount non-negative; each line is a debit or
 * a credit but not both; total debits equal total credits exactly; the entry is
 * non-zero
 */
export const validateJournalLines = (lines: JournalLineInput[]): void => {
  if (lines.length < 2) {
    throw new Error("A journal entry needs at least two lines");
  }

  let debitUnits = 0;
  let creditUnits = 0;
  for (const line of lines) {
    const debit = toUnits(line.debit);
    const credit = toUnits(line.credit);

    if (debit < 0 || credit < 0) {
      throw new Error("Journal line amounts cannot be negative");
    }
    if (debit > 0 && credit > 0) {
      throw new Error("A journal line cannot have both a debit and a credit");
    }
    if (debit === 0 && credit === 0) {
      throw new Error("Each journal line needs a debit or a credit");
    }

    debitUnits += debit;
    creditUnits += credit;
  }

  if (debitUnits !== creditUnits) {
    throw new Error(
      "Journal entry does not balance (debits must equal credits)",
    );
  }
  if (debitUnits === 0) {
    throw new Error("A journal entry cannot be zero");
  }
};
