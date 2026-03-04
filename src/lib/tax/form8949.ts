import { and, between, eq, isNotNull, sql } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { cryptoAssetTable, cryptoLotTable } from "lib/db/schema";

type DisposalItem = {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: string;
  costBasis: string;
  gainOrLoss: string;
};

type Form8949Report = {
  bookId: string;
  year: number;
  shortTerm: DisposalItem[];
  longTerm: DisposalItem[];
  totalShortTermGainLoss: string;
  totalLongTermGainLoss: string;
  netGainLoss: string;
  generatedAt: string;
};

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Generate IRS Form 8949 (Sales and Dispositions of Capital Assets) for crypto.
 * Queries disposed lots within the tax year and classifies each as short-term
 * or long-term based on holding period
 * @param params - Book ID and tax year
 * @returns Form 8949 data with short-term/long-term items and totals
 */
const generateForm8949 = async (params: {
  bookId: string;
  year: number;
}): Promise<Form8949Report> => {
  const { bookId, year } = params;
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  // Query disposed lots within the tax year
  const lots = await dbPool
    .select({
      symbol: cryptoAssetTable.symbol,
      acquiredAt: cryptoLotTable.acquiredAt,
      disposedAt: cryptoLotTable.disposedAt,
      quantity: cryptoLotTable.quantity,
      costPerUnit: cryptoLotTable.costPerUnit,
      proceedsPerUnit: cryptoLotTable.proceedsPerUnit,
    })
    .from(cryptoLotTable)
    .innerJoin(
      cryptoAssetTable,
      eq(cryptoLotTable.cryptoAssetId, cryptoAssetTable.id),
    )
    .where(
      and(
        eq(cryptoAssetTable.bookId, bookId),
        isNotNull(cryptoLotTable.disposedAt),
        isNotNull(cryptoLotTable.proceedsPerUnit),
        between(sql`${cryptoLotTable.disposedAt}`, startDate, endDate),
      ),
    );

  const shortTerm: DisposalItem[] = [];
  const longTerm: DisposalItem[] = [];
  let totalShortTermGainLoss = 0;
  let totalLongTermGainLoss = 0;

  for (const lot of lots) {
    if (!lot.disposedAt || !lot.proceedsPerUnit) continue;

    const qty = Number.parseFloat(lot.quantity);
    const costBasis = qty * Number.parseFloat(lot.costPerUnit);
    const proceeds = qty * Number.parseFloat(lot.proceedsPerUnit);
    const gainOrLoss = proceeds - costBasis;

    const acquiredDate = new Date(lot.acquiredAt);
    const disposedDate = new Date(lot.disposedAt);
    const holdingPeriodMs = disposedDate.getTime() - acquiredDate.getTime();
    const isLongTerm = holdingPeriodMs >= ONE_YEAR_MS;

    const item: DisposalItem = {
      description: `${qty} ${lot.symbol}`,
      dateAcquired: acquiredDate.toISOString().split("T")[0],
      dateSold: disposedDate.toISOString().split("T")[0],
      proceeds: proceeds.toFixed(2),
      costBasis: costBasis.toFixed(2),
      gainOrLoss: gainOrLoss.toFixed(2),
    };

    if (isLongTerm) {
      longTerm.push(item);
      totalLongTermGainLoss += gainOrLoss;
    } else {
      shortTerm.push(item);
      totalShortTermGainLoss += gainOrLoss;
    }
  }

  return {
    bookId,
    year,
    shortTerm,
    longTerm,
    totalShortTermGainLoss: totalShortTermGainLoss.toFixed(2),
    totalLongTermGainLoss: totalLongTermGainLoss.toFixed(2),
    netGainLoss: (totalShortTermGainLoss + totalLongTermGainLoss).toFixed(2),
    generatedAt: new Date().toISOString(),
  };
};

export default generateForm8949;
