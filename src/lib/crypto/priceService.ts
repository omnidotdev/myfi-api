const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

// Cache prices for 60 seconds to avoid CoinGecko rate limits
const CACHE_TTL_MS = 60_000;

type CoinPrice = {
  usd: number;
  usd_24h_change?: number;
};

type PriceData = {
  [coinId: string]: CoinPrice;
};

type CachedPrices = {
  data: PriceData;
  fetchedAt: number;
};

type HistoricalPriceData = {
  coinId: string;
  date: string;
  usd: number | null;
};

let priceCache: CachedPrices | null = null;
let cachedCoinIds: string | null = null;

/**
 * Fetch current prices for multiple coins from CoinGecko.
 * @param coinIds - Comma-separated CoinGecko coin IDs (e.g. "bitcoin,ethereum,solana")
 * @returns Price data keyed by coin ID
 */
const fetchPrices = async (coinIds: string): Promise<PriceData> => {
  // Return cached data if still fresh and for the same coin set
  if (
    priceCache &&
    cachedCoinIds === coinIds &&
    Date.now() - priceCache.fetchedAt < CACHE_TTL_MS
  ) {
    return priceCache.data;
  }

  const url = `${COINGECKO_BASE_URL}/simple/price?ids=${encodeURIComponent(coinIds)}&vs_currencies=usd&include_24hr_change=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText}`,
    );
  }

  const data: PriceData = await response.json();

  priceCache = { data, fetchedAt: Date.now() };
  cachedCoinIds = coinIds;

  return data;
};

/**
 * Fetch historical price for a coin on a specific date.
 * @param coinId - CoinGecko coin ID (e.g. "bitcoin")
 * @param date - Date string in YYYY-MM-DD format
 * @returns Historical price data
 */
const fetchHistoricalPrice = async (
  coinId: string,
  date: string,
): Promise<HistoricalPriceData> => {
  // CoinGecko expects DD-MM-YYYY format
  const [year, month, day] = date.split("-");
  const formattedDate = `${day}-${month}-${year}`;

  const url = `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(coinId)}/history?date=${formattedDate}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  return {
    coinId,
    date,
    usd: data.market_data?.current_price?.usd ?? null,
  };
};

export { fetchHistoricalPrice, fetchPrices };
