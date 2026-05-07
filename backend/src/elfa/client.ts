import ky from "ky";
import { config } from "../config";
import { getElfaTrendCache, setElfaTrendCache } from "../db";
import type {
  TrendingTokenItem,
  TrendingCAItem,
  MentionItem,
  TopMentionsResponse,
  ChatResponse,
  TrendingNarrativeItem,
  TrendingNarrativesResponse,
  KeywordMentionsResponse,
} from "./types";

const elfa = ky.create({
  baseUrl: config.ELFA_API_BASE,
  headers: { "x-elfa-api-key": config.ELFA_API_KEY },
  timeout: 30_000,
  retry: { limit: 3, delay: () => 2000 },
});

const CACHE_TTL_MS = 15 * 60 * 1000;

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = await getElfaTrendCache(key);
  if (hit && Date.now() - Number(hit.fetched_at) < CACHE_TTL_MS) {
    return hit.data as T;
  }
  const data = await fetcher();
  await setElfaTrendCache(key, data);
  return data;
}

// ── Trending tokens ──────────────────────────────────────────────────────
// Response shape: { success, data: { pageSize, page, total, data: TrendingTokenItem[] } }

interface TrendingTokensResponse {
  success: boolean;
  data: { pageSize: number; page: number; total: number; data: TrendingTokenItem[] };
}

export async function getTrendingTokens(
  timeWindow = "1h",
  pageSize = 50,
): Promise<TrendingTokenItem[]> {
  return cached<TrendingTokenItem[]>(
    `trending-tokens:${timeWindow}:${pageSize}`,
    async () => {
      const res = await elfa
        .get("/v2/aggregations/trending-tokens", {
          searchParams: { timeWindow, pageSize },
        })
        .json<TrendingTokensResponse>();
      return res.data?.data ?? [];
    },
  );
}

// ── Trending CAs ─────────────────────────────────────────────────────────
// Response shape: { success, data: { pageSize, page, total, data: TrendingCAItem[] } }

interface TrendingCAsResponse {
  success: boolean;
  data: { pageSize: number; page: number; total: number; data: TrendingCAItem[] };
}

export async function getTrendingCAsTwitter(
  timeWindow = "1h",
): Promise<TrendingCAItem[]> {
  return cached<TrendingCAItem[]>(`trending-cas:twitter:${timeWindow}`, async () => {
    const res = await elfa
      .get("/v2/aggregations/trending-cas/twitter", {
        searchParams: { timeWindow },
      })
      .json<TrendingCAsResponse>();
    return res.data?.data ?? [];
  });
}

export async function getTrendingCAsTelegram(
  timeWindow = "1h",
): Promise<TrendingCAItem[]> {
  return cached<TrendingCAItem[]>(`trending-cas:telegram:${timeWindow}`, async () => {
    const res = await elfa
      .get("/v2/aggregations/trending-cas/telegram", {
        searchParams: { timeWindow },
      })
      .json<TrendingCAsResponse>();
    return res.data?.data ?? [];
  });
}

// ── Top mentions ─────────────────────────────────────────────────────────
// Param name is `ticker` (not `symbol`). Optionally prefix `$` for cashtag-only.
// Response shape: { success, data: MentionItem[], metadata: { total } }

export async function getTopMentions(
  ticker: string,
  timeWindow = "1h",
): Promise<TopMentionsResponse> {
  return cached<TopMentionsResponse>(
    `top-mentions:${ticker}:${timeWindow}`,
    async () => {
      const res = await elfa
        .get("/v2/data/top-mentions", { searchParams: { ticker, timeWindow } })
        .json<{ success: boolean; data: MentionItem[]; metadata: TopMentionsResponse["metadata"] }>();
      return { data: res.data ?? [], metadata: res.metadata };
    },
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────
// Body field is `message` (not `query`). `analysisType` defaults to "chat".

export async function elfaChat(
  message: string,
  speed: "fast" | "expert" = "fast",
  sessionId?: string,
): Promise<{ message: string; sessionId: string }> {
  const body: Record<string, unknown> = { message, analysisType: "chat", speed };
  if (sessionId) body.sessionId = sessionId;

  const res = await elfa.post("/v2/chat", { json: body }).json<ChatResponse>();
  return { message: res.data.message, sessionId: res.data.sessionId };
}

// ── Trending narratives ──────────────────────────────────────────────────
// Response: { success, data: { metadata, trending_narratives: TrendingNarrativeItem[] } }

interface TrendingNarrativesApiResponse {
  success: boolean;
  data: {
    metadata: { total_tweets?: number; total_narratives?: number; error?: string };
    trending_narratives: TrendingNarrativeItem[];
  };
}

export async function getTrendingNarratives(
  timeFrame: "day" | "week" = "day",
  maxNarratives = 10,
): Promise<TrendingNarrativesResponse> {
  return cached<TrendingNarrativesResponse>(
    `narratives:${timeFrame}:${maxNarratives}`,
    async () => {
      const res = await elfa
        .get("/v2/data/trending-narratives", {
          searchParams: { timeFrame, maxNarratives },
        })
        .json<TrendingNarrativesApiResponse>();
      return {
        metadata: res.data.metadata ?? {},
        narratives: res.data.trending_narratives ?? [],
      };
    },
  );
}

// ── Keyword mentions ─────────────────────────────────────────────────────
// `keywords` accepts up to 5 comma-separated terms. Pass single keyword for
// per-trend volume, or batch if you want to fetch multiple at once.

interface KeywordMentionsApiResponse {
  success: boolean;
  data: MentionItem[];
  metadata: { total: number; cursor?: string };
}

export async function getKeywordMentions(
  keywords: string | string[],
  timeWindow = "1h",
): Promise<KeywordMentionsResponse> {
  const kw = Array.isArray(keywords) ? keywords.join(",") : keywords;
  if (Array.isArray(keywords) && keywords.length > 5) {
    throw new Error("getKeywordMentions accepts max 5 keywords");
  }
  return cached<KeywordMentionsResponse>(
    `keyword-mentions:${kw}:${timeWindow}`,
    async () => {
      const res = await elfa
        .get("/v2/data/keyword-mentions", {
          searchParams: { keywords: kw, timeWindow },
        })
        .json<KeywordMentionsApiResponse>();
      return { data: res.data ?? [], metadata: res.metadata };
    },
  );
}

// ── Trend identifier normalization ───────────────────────────────────────
// On-chain identifier is [u8; 32]. Trend markets use prefix `trend:` + slug.
// Free-form phrase ("Chinese Baddies", "AI Agents") → slug, then prefix.

const TREND_PREFIX = "trend:";
const MAX_IDENTIFIER_BYTES = 32;

/** Slugify a phrase: lowercase, strip non-alphanumeric, collapse to dash. */
function slugify(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Normalize an arbitrary trend phrase to the on-chain identifier convention.
 * Truncates aggressively to fit 32 UTF-8 bytes — keeps readability by snapping
 * to the last word boundary rather than mid-word.
 *   "Chinese Baddies"                            → "trend:chinese-baddies"
 *   "Anthropic partners with SpaceX to boost..." → "trend:anthropic-partners-with"
 *   "Bitcoin price surge to $82,302"             → "trend:bitcoin-price-surge-to"
 */
export function normalizeTrendId(phrase: string): string | null {
  const slug = slugify(phrase);
  if (!slug) return null;

  const prefixBytes = Buffer.byteLength(TREND_PREFIX, "utf-8");
  const maxSlugBytes = MAX_IDENTIFIER_BYTES - prefixBytes;

  // Fits as-is
  if (Buffer.byteLength(slug, "utf-8") <= maxSlugBytes) {
    return `${TREND_PREFIX}${slug}`;
  }

  // Need to truncate. Take first maxSlugBytes bytes, then snap back to the
  // last dash boundary so we don't cut a word mid-stream. If the last dash is
  // suspiciously early (slug becomes single-word stump), keep the byte cut as-is.
  let truncated = slug.slice(0, maxSlugBytes);
  // Watch out for multi-byte chars at the boundary: re-validate length
  while (Buffer.byteLength(truncated, "utf-8") > maxSlugBytes) {
    truncated = truncated.slice(0, -1);
  }
  const lastDash = truncated.lastIndexOf("-");
  if (lastDash >= Math.floor(maxSlugBytes / 2)) {
    truncated = truncated.slice(0, lastDash);
  }
  // Final guard: strip trailing dash if any
  truncated = truncated.replace(/-+$/, "");
  if (!truncated) return null;

  return `${TREND_PREFIX}${truncated}`;
}

/** Reverse: extract the keyword from a trend identifier. */
export function trendIdToKeyword(identifier: string): string | null {
  if (!identifier.startsWith(TREND_PREFIX)) return null;
  return identifier.slice(TREND_PREFIX.length).replace(/-/g, " ");
}

export function isTrendId(identifier: string): boolean {
  return identifier.startsWith(TREND_PREFIX);
}

// ── Mindshare proxy helpers ──────────────────────────────────────────────
// API doesn't expose `mindshare_pct` directly — derive from current_count
// proportions or top-mentions volume.

/** Compute relative mindshare (0..10000 bps) from a token's share of total
 *  mention counts in a trending batch. */
export function tokenMindshareBps(
  token: TrendingTokenItem,
  batch: TrendingTokenItem[],
): number {
  const total = batch.reduce((s, t) => s + (t.current_count ?? 0), 0);
  if (total === 0) return 0;
  const share = (token.current_count ?? 0) / total;
  return Math.min(10_000, Math.round(share * 10_000));
}

/** Compute mindshare proxy from top-mentions response — uses metadata.total
 *  as a raw signal scaled to bps with a cap. */
export function topMentionsToBps(total: number, scale = 10): number {
  return Math.min(100_000, total * scale);
}
