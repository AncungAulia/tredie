import { log } from "../utils/log";

// Clearbit logo CDN for equities/companies (HIP-3 symbol → company domain)
const EQUITY_DOMAIN_MAP: Record<string, string> = {
  NVDA: "nvidia.com",
  AAPL: "apple.com",
  TSLA: "tesla.com",
  AMZN: "amazon.com",
  MSFT: "microsoft.com",
  GOOGL: "google.com",
  GOOG: "google.com",
  META: "meta.com",
  NFLX: "netflix.com",
  AMD: "amd.com",
  INTC: "intel.com",
  COIN: "coinbase.com",
  MSTR: "microstrategy.com",
  GME: "gamestop.com",
  PLTR: "palantir.com",
  SHOP: "shopify.com",
  HOOD: "robinhood.com",
  ARM: "arm.com",
  SMCI: "supermicro.com",
  MARA: "mara.com",
  RIOT: "riotplatforms.com",
  BITO: "proshares.com",
  IBIT: "blackrock.com",
  FBTC: "fidelity.com",
  ARKK: "ark-invest.com",
  SQQQ: "proshares.com",
};

// In-memory cache: symbol → { url | null, expires }
const cgCache = new Map<string, { url: string | null; expires: number }>();

/**
 * Resolve a logo URL for a ticker symbol.
 *
 * - Class 0/1 (crypto):           CoinGecko search API (cached 24h)
 * - Class 2 (equity):             Clearbit by company domain, CoinGecko fallback
 * - Class 3 (commodity):          CoinGecko fallback
 * - Class 4 (FX):                 null — letter-avatar is fine for FX pairs
 * - Class 5 (Solana CA):          handled by MetadataEnricher, not this function
 * - Class 6 (narrative/trend):    null — letter-avatar is fine
 */
export async function resolveTickerImage(
  rawSymbol: string,
  assetClass: number,
): Promise<string | null> {
  if (assetClass === 4 || assetClass === 5 || assetClass === 6) return null;

  // Strip xyz: prefix for equities / commodities
  const symbol = rawSymbol.startsWith("xyz:") ? rawSymbol.slice(4) : rawSymbol;

  if (assetClass === 2) {
    const domain = EQUITY_DOMAIN_MAP[symbol];
    if (domain) return `https://logo.clearbit.com/${domain}`;
    // Fall through to CoinGecko for unmapped equity symbols
  }

  // Crypto (0/1), unmapped equity (2), commodity (3): CoinGecko search
  const hit = cgCache.get(symbol);
  if (hit && Date.now() < hit.expires) return hit.url;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      coins: Array<{ symbol: string; large: string }>;
    };
    const match = data.coins.find(
      (c) => c.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    const url = match?.large ?? null;
    cgCache.set(symbol, { url, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return url;
  } catch (e) {
    log.debug({ err: e, symbol }, "CoinGecko image lookup failed");
    // Cache failure for 1h to avoid hammering on rate-limit
    cgCache.set(symbol, { url: null, expires: Date.now() + 60 * 60 * 1000 });
    return null;
  }
}

/**
 * Derive the base ticker from an attention-token identifier.
 *   class 0/1:  "aBTC"   → "BTC"
 *   class 2/3/4: "axNVDA" → "NVDA"
 *   class 5:    base58 CA (no transformation)
 *   class 6:    camelCase trend id (no useful ticker)
 */
export function tickerFromIdentifier(
  identifier: string,
  assetClass: number,
): string | null {
  if (assetClass === 0 || assetClass === 1) {
    return identifier.startsWith("a") ? identifier.slice(1) : null;
  }
  if (assetClass >= 2 && assetClass <= 4) {
    return identifier.startsWith("ax") ? identifier.slice(2) : null;
  }
  return null;
}
