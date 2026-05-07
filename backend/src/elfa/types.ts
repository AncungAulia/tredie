// Wire-level shapes matching the Elfa OpenAPI spec
// (https://github.com/elfa-ai/elfa-ai-skill — references/swagger.json).

// ── Data endpoints ───────────────────────────────────────────────────────

/** Item in `data.data` array of `GET /v2/aggregations/trending-tokens`.
 *  Note: API returns snake_case for tokens but camelCase for CAs — wire-format
 *  mismatch confirmed against live API, do NOT homogenize. */
export interface TrendingTokenItem {
  token: string;
  current_count: number;
  previous_count: number;
  change_percent: number;
}

/** Item in `data.data` array of `GET /v2/aggregations/trending-cas/{platform}`. */
export interface TrendingCAItem {
  contractAddress: string;
  chain: string;
  mentionCount: number;
}

/** Item in `data` array of `GET /v2/data/top-mentions`. */
export interface MentionItem {
  tweetId: string;
  link: string;
  likeCount: number | null;
  repostCount: number | null;
  viewCount: number | null;
  quoteCount: number | null;
  replyCount: number | null;
  bookmarkCount: number | null;
  mentionedAt: string;
  type: "repost" | "post" | "quote" | "reply" | "note" | "article";
}

/** Top-mentions response wraps array under `data` plus `metadata.total`. */
export interface TopMentionsResponse {
  data: MentionItem[];
  metadata: { pageSize: number; page: number; total: number };
}

/** Item in `data.trending_narratives` of `GET /v2/data/trending-narratives`. */
export interface TrendingNarrativeItem {
  narrative: string;
  tweet_ids: string[];
  source_links: string[];
}

/** Wrapped trending-narratives response. */
export interface TrendingNarrativesResponse {
  metadata: { total_tweets?: number; total_narratives?: number; error?: string };
  narratives: TrendingNarrativeItem[];
}

/** `GET /v2/data/keyword-mentions` returns MentionV2[] + metadata.total. */
export interface KeywordMentionsResponse {
  data: MentionItem[];
  metadata: { total: number; cursor?: string };
}

/** `POST /v2/chat` body. `message` is required for `analysisType: "chat"`. */
export interface ChatRequest {
  message: string;
  analysisType?: "chat" | "macro" | "summary" | "tokenIntro" | "tokenAnalysis" | "accountAnalysis";
  speed?: "fast" | "expert";
  sessionId?: string;
}

/** `POST /v2/chat` response (ChatResponseV2). */
export interface ChatResponse {
  data: {
    message: string;
    sessionId: string;
    creditsConsumed: number;
  };
}

// ── Auto endpoints ───────────────────────────────────────────────────────

/** Inner EQL query — what gets stored & evaluated. */
export interface EqlQuery {
  conditions: object;
  actions: { stepId: string; type: string; params: object }[];
  expiresIn: string;
}

/** Body of `POST /v2/auto/queries` and `POST /v2/auto/queries/validate`. */
export interface AutoQueryRequest {
  title?: string;
  description?: string;
  query: EqlQuery;
}

export interface AutoCreateQueryResponse {
  queryId: string;
  status: string;
}

export interface AutoValidateResult {
  valid: boolean;
  errors?: string[];
}
