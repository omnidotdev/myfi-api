interface ComparableLine {
  accountId: string;
  accountName: string;
  accountType: string;
  subType: string | null;
  accountCode?: string | null;
}

export interface ComparativeRow {
  accountId: string;
  accountName: string;
  accountType: string;
  subType: string | null;
  accountCode: string | null;
  current: string;
  prior: string;
  variance: string;
  /** Percent change vs prior, as a string; null when prior is zero */
  variancePct: string | null;
}

/**
 * Merge current-period and prior-period report lines into comparative rows
 * (current, prior, variance, variance percent), keyed by account so an account
 * present in only one period still appears. Pure and value-accessor driven so
 * it serves both P&L (net amount) and balance sheet (balance) lines
 */
export const mergeComparative = <T extends ComparableLine>(
  current: T[],
  prior: T[],
  value: (line: T) => string,
): ComparativeRow[] => {
  const byId = new Map<string, { line: T; current: number; prior: number }>();

  for (const line of current) {
    byId.set(line.accountId, {
      line,
      current: Number.parseFloat(value(line)) || 0,
      prior: 0,
    });
  }
  for (const line of prior) {
    const existing = byId.get(line.accountId);
    const priorValue = Number.parseFloat(value(line)) || 0;
    if (existing) {
      existing.prior = priorValue;
    } else {
      byId.set(line.accountId, { line, current: 0, prior: priorValue });
    }
  }

  const rows: ComparativeRow[] = [];
  for (const { line, current: cur, prior: pri } of byId.values()) {
    const variance = cur - pri;
    rows.push({
      accountId: line.accountId,
      accountName: line.accountName,
      accountType: line.accountType,
      subType: line.subType,
      accountCode: line.accountCode ?? null,
      current: cur.toFixed(2),
      prior: pri.toFixed(2),
      variance: variance.toFixed(2),
      variancePct:
        pri === 0 ? null : ((variance / Math.abs(pri)) * 100).toFixed(1),
    });
  }
  return rows;
};

/** Comparative summary of a single total (current, prior, variance, percent) */
export const compareTotal = (
  current: string,
  prior: string,
): {
  current: string;
  prior: string;
  variance: string;
  variancePct: string | null;
} => {
  const cur = Number.parseFloat(current) || 0;
  const pri = Number.parseFloat(prior) || 0;
  const variance = cur - pri;
  return {
    current: cur.toFixed(2),
    prior: pri.toFixed(2),
    variance: variance.toFixed(2),
    variancePct:
      pri === 0 ? null : ((variance / Math.abs(pri)) * 100).toFixed(1),
  };
};
