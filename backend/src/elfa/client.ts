import ky from "ky";
import { config } from "../config";
import { geminiChat } from "../ai/gemini-chat";
import { log } from "../utils/log";
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

  try {
    const res = await elfa.post("/v2/chat", { json: body }).json<ChatResponse>();
    return { message: res.data.message, sessionId: res.data.sessionId };
  } catch (e: any) {
    // /v2/chat butuh plan Grow / Pay-as-you-go. Di plan gratis Elfa balas 403,
    // dan itu bukan kondisi transien — jadi jangan dilempar, fallback ke Gemini
    // supaya ai-context dan trend extraction tetap jalan.
    if (e?.response?.status === 403) {
      log.warn("Elfa /v2/chat 403 (plan-gated) — fallback ke Gemini");
      const message2 = await geminiChat(message);
      return { message: message2, sessionId: sessionId ?? "gemini-fallback" };
    }
    throw e;
  }
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
// Trend identifiers are pure camelCase, no prefix. The lowercase first
// letter visually distinguishes trends from token-class identifiers
// ("aBTC", "axNVDA") which start with "a"+UPPERCASE.
//
// Total length capped at 10 BYTES — the on-chain SC derives the SPL symbol
// verbatim from the identifier and Metaplex caps symbols at 10 bytes.
//
// Legacy formats still recognized by trendIdToKeyword for any markets
// spawned before this convention change:
//   - "trend:foo" (pre-MPL era)
//   - "t:foo"     (post-MPL, pre-attention-prefix era)

const LEGACY_TREND_PREFIX_OLD = "trend:";
const LEGACY_TREND_PREFIX = "t:";
const MAX_IDENTIFIER_BYTES = 10;

/**
 * Convert a free-form phrase to a camelCase slug fitting in 10 UTF-8 bytes.
 *   "Chinese Baddies"                            → "chinese"
 *   "Anthropic partners with SpaceX to boost..." → "anthSpacex"
 *   "BTC ETF approval"                           → "btcEtf"
 *
 * Backend's AI judge (Gemini) usually outputs better slugs by picking the
 * meme's identity rather than a literal sentence prefix — this function is
 * the rule-based fallback when AI gating is disabled or rate-limited.
 */
export function normalizeTrendId(phrase: string): string | null {
  const words = phrase
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;

  // Build camelCase: first word lowercase, subsequent words PascalCase.
  let camel = words[0];
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    camel += w[0].toUpperCase() + w.slice(1);
    if (Buffer.byteLength(camel, "utf-8") >= MAX_IDENTIFIER_BYTES) break;
  }

  // Truncate to byte budget.
  while (Buffer.byteLength(camel, "utf-8") > MAX_IDENTIFIER_BYTES) {
    camel = camel.slice(0, -1);
  }
  if (camel.length < 2) return null;

  // Must start with a lowercase letter (matches validateIdentifier regex).
  if (!/^[a-z]/.test(camel)) return null;
  return camel;
}

/**
 * Reverse: extract a search keyword from a trend identifier. Handles all
 * three conventions (current camelCase, legacy "t:" prefix, legacy "trend:"
 * prefix) so auto-manager queries keep working across migrations.
 */
export function trendIdToKeyword(identifier: string): string | null {
  if (identifier.startsWith(LEGACY_TREND_PREFIX_OLD)) {
    return identifier.slice(LEGACY_TREND_PREFIX_OLD.length).replace(/-/g, " ");
  }
  if (identifier.startsWith(LEGACY_TREND_PREFIX)) {
    return identifier.slice(LEGACY_TREND_PREFIX.length).replace(/-/g, " ");
  }
  // Current camelCase: split on case transitions for a readable keyword.
  if (/^[a-z]/.test(identifier)) {
    return identifier.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  }
  return null;
}

/**
 * Heuristic: a trend identifier starts with a lowercase letter (camelCase).
 * Token-class identifiers ("aBTC", "axNVDA") all start with "a"+UPPERCASE,
 * so the second-char case is the discriminator. Legacy "t:" / "trend:"
 * prefixes are also recognized.
 *
 * Prefer reading `market.asset_class === 6` directly when available — this
 * helper is for cases where you only have the identifier string.
 */
export function isTrendId(identifier: string): boolean {
  if (identifier.startsWith(LEGACY_TREND_PREFIX_OLD)) return true;
  if (identifier.startsWith(LEGACY_TREND_PREFIX)) return true;
  // current convention: lowercase first char + lowercase second char
  // (rules out "aBTC" / "axNVDA" / etc).
  if (identifier.length >= 2 && /^[a-z]/.test(identifier) && /^.[a-z0-9]/.test(identifier)) {
    return true;
  }
  return false;
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
