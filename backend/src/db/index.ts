import postgres from "postgres";
import { config } from "../config";

export const sql = postgres(config.DATABASE_URL, {
  ssl: "require",
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  types: {
    bigint: postgres.BigInt,
  },
});

// ── Row types ────────────────────────────────────────────────────────────

export interface MarketRow {
  id: bigint;
  pda: string;
  mint: string;
  identifier: string;
  asset_class: number;
  display_name: string | null;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  source_metadata: unknown | null;
  base_virtual_sol: bigint;
  virtual_token_supply: bigint;
  real_sol_reserves: bigint;
  tokens_minted: bigint;
  current_mindshare_bps: number;
  peak_mindshare_bps: number;
  ratchet_multiplier_bps: number;
  creator_pubkey: string;
  creator_source: "auto_spawn" | "user_search" | "user_link_paste";
  created_at: bigint;
  last_synced_slot: bigint;
}

export interface TradeRow {
  id: bigint;
  signature: string;
  market_pda: string;
  side: 0 | 1;
  trader: string;
  sol_amount: bigint;
  token_amount: bigint;
  ratchet_bps: number;
  block_time: bigint;
  slot: bigint;
}

export interface MindshareHistoryRow {
  id: bigint;
  market_pda: string;
  current_bps: number;
  peak_bps: number;
  ratchet_bps: number;
  source: "rest_poll" | "auto_event" | "manual";
  recorded_at: bigint;
  tx_signature: string | null;
}

export interface TrendingTokenRow {
  id: bigint;
  symbol: string;
  mention_count: number;
  mindshare_pct: number | null;
  rank_position: number | null;
  fetched_at: bigint;
}

export interface TrendingCARow {
  id: bigint;
  contract_address: string;
  source_platform: "twitter" | "telegram";
  mention_count: number;
  rank_position: number | null;
  fetched_at: bigint;
}

export interface TokenMetadataRow {
  contract_address: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
  decimals: number | null;
  total_supply: string | null;
  source: "helius_das" | "jupiter" | "manual" | null;
  fetched_at: bigint;
}

export interface AutoQueryRow {
  id: bigint;
  query_id: string;
  query_type: string;
  market_pda: string | null;
  config: unknown;
  status: "active" | "cancelled" | "expired" | "failed";
  created_at: bigint;
  expires_at: bigint | null;
  error_reason: string | null;
}

export interface MarketCandidateRow {
  id: bigint;
  source_kind:
    | "narrative"
    | "token"
    | "ca_twitter"
    | "ca_telegram"
    | "user_search"
    | "user_link_paste";
  source_key: string;
  raw_input: unknown;
  verdict:
    | "pending"
    | "spawn"
    | "skip"
    | "merge"
    | "manual_approve"
    | "manual_reject"
    | "spawn_failed";
  ai_identifier: string | null;
  ai_display_name: string | null;
  ai_asset_class: number | null;
  ai_confidence_bps: number | null;
  ai_reason: string | null;
  ai_model: string | null;
  merged_with: string | null;
  spawn_market_pda: string | null;
  created_at: bigint;
  decided_at: bigint | null;
}

export interface LinkCacheRow {
  url: string;
  platform: string;
  metadata: unknown;
  extracted_symbol: string | null;
  resolved_at: bigint;
  expires_at: bigint;
}

// ── Markets ──────────────────────────────────────────────────────────────

export async function getMarketByIdentifier(identifier: string) {
  const [row] = await sql<MarketRow[]>`
    SELECT * FROM markets WHERE identifier = ${identifier} LIMIT 1
  `;
  return row;
}

export async function getMarketByPda(pda: string) {
  const [row] = await sql<MarketRow[]>`
    SELECT * FROM markets WHERE pda = ${pda} LIMIT 1
  `;
  return row;
}

export async function getAllActiveMarkets(): Promise<MarketRow[]> {
  return sql<MarketRow[]>`
    SELECT * FROM markets ORDER BY current_mindshare_bps DESC
  `;
}

export async function upsertMarket(m: {
  pda: string;
  mint: string;
  identifier: string;
  asset_class: number;
  display_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  source_metadata?: unknown | null;
  base_virtual_sol: bigint;
  virtual_token_supply: bigint;
  real_sol_reserves?: bigint;
  tokens_minted?: bigint;
  creator_pubkey: string;
  creator_source: string;
  created_at: bigint;
  last_synced_slot?: bigint;
}) {
  await sql`
    INSERT INTO markets ${sql({
      pda: m.pda,
      mint: m.mint,
      identifier: m.identifier,
      asset_class: m.asset_class,
      display_name: m.display_name ?? null,
      description: m.description ?? null,
      image_url: m.image_url ?? null,
      source_url: m.source_url ?? null,
      source_metadata: (m.source_metadata ?? null) as any,
      base_virtual_sol: m.base_virtual_sol,
      virtual_token_supply: m.virtual_token_supply,
      real_sol_reserves: m.real_sol_reserves ?? 0n,
      tokens_minted: m.tokens_minted ?? 0n,
      creator_pubkey: m.creator_pubkey,
      creator_source: m.creator_source,
      created_at: m.created_at,
      last_synced_slot: m.last_synced_slot ?? 0n,
    } as any)}
    ON CONFLICT (identifier) DO UPDATE SET
      real_sol_reserves = EXCLUDED.real_sol_reserves,
      tokens_minted     = EXCLUDED.tokens_minted,
      last_synced_slot  = EXCLUDED.last_synced_slot,
      display_name      = COALESCE(EXCLUDED.display_name, markets.display_name),
      image_url         = COALESCE(EXCLUDED.image_url, markets.image_url)
  `;
}

export async function syncMarketStateFromTrade(opts: {
  pda: string;
  real_sol_reserves: bigint;
  tokens_minted: bigint;
  slot: bigint;
}) {
  await sql`
    UPDATE markets
    SET real_sol_reserves = ${opts.real_sol_reserves},
        tokens_minted     = ${opts.tokens_minted},
        last_synced_slot  = ${opts.slot}
    WHERE pda = ${opts.pda} AND last_synced_slot < ${opts.slot}
  `;
}

export async function updateMarketMindshare(
  pda: string,
  currentBps: number,
  peakBps: number,
  ratchetBps: number,
) {
  await sql`
    UPDATE markets
    SET current_mindshare_bps  = ${currentBps},
        peak_mindshare_bps     = ${peakBps},
        ratchet_multiplier_bps = ${ratchetBps}
    WHERE pda = ${pda}
  `;
}

// ── Trades ───────────────────────────────────────────────────────────────

export async function insertTrade(t: Omit<TradeRow, "id">) {
  await sql`
    INSERT INTO trades ${sql(t as unknown as Record<string, unknown>)}
    ON CONFLICT (signature) DO NOTHING
  `;
}

export async function getRecentTrades(marketPda: string, limit = 50) {
  return sql<TradeRow[]>`
    SELECT * FROM trades WHERE market_pda = ${marketPda}
    ORDER BY block_time DESC LIMIT ${limit}
  `;
}

// ── Mindshare history ───────────────────────────────────────────────────

export async function appendMindshareHistory(h: {
  market_pda: string;
  current_bps: number;
  peak_bps?: number;
  ratchet_bps?: number;
  source: "rest_poll" | "auto_event" | "manual";
  recorded_at: bigint;
  tx_signature?: string | null;
}) {
  await sql`
    INSERT INTO mindshare_history ${sql({
      market_pda: h.market_pda,
      current_bps: h.current_bps,
      peak_bps: h.peak_bps ?? 0,
      ratchet_bps: h.ratchet_bps ?? 10000,
      source: h.source,
      recorded_at: h.recorded_at,
      tx_signature: h.tx_signature ?? null,
    })}
  `;
}

export async function getLastMindshareEntry(marketPda: string) {
  const [row] = await sql<MindshareHistoryRow[]>`
    SELECT * FROM mindshare_history WHERE market_pda = ${marketPda}
    ORDER BY recorded_at DESC LIMIT 1
  `;
  return row;
}

export async function getMindshareHistory(marketPda: string, limit = 200) {
  return sql<MindshareHistoryRow[]>`
    SELECT * FROM mindshare_history WHERE market_pda = ${marketPda}
    ORDER BY recorded_at ASC LIMIT ${limit}
  `;
}

// ── Trending ─────────────────────────────────────────────────────────────

export async function upsertTrendingToken(t: Omit<TrendingTokenRow, "id">) {
  await sql`INSERT INTO trending_tokens ${sql(t as unknown as Record<string, unknown>)}`;
}

export async function getLatestTrendingToken(symbol: string) {
  const [row] = await sql<TrendingTokenRow[]>`
    SELECT * FROM trending_tokens WHERE symbol = ${symbol}
    ORDER BY fetched_at DESC LIMIT 1
  `;
  return row;
}

export async function upsertTrendingCA(c: Omit<TrendingCARow, "id">) {
  await sql`
    INSERT INTO trending_cas ${sql(c as unknown as Record<string, unknown>)}
    ON CONFLICT (contract_address, source_platform, fetched_at) DO NOTHING
  `;
}

// ── Token metadata ───────────────────────────────────────────────────────

export async function getTokenMetadata(addr: string) {
  const [row] = await sql<TokenMetadataRow[]>`
    SELECT * FROM token_metadata WHERE contract_address = ${addr} LIMIT 1
  `;
  return row;
}

export async function cacheTokenMetadata(m: TokenMetadataRow) {
  await sql`
    INSERT INTO token_metadata ${sql(m as unknown as Record<string, unknown>)}
    ON CONFLICT (contract_address) DO UPDATE SET
      symbol = EXCLUDED.symbol, name = EXCLUDED.name,
      image_url = EXCLUDED.image_url, decimals = EXCLUDED.decimals,
      total_supply = EXCLUDED.total_supply, source = EXCLUDED.source,
      fetched_at = EXCLUDED.fetched_at
  `;
}

// ── Auto queries / events ───────────────────────────────────────────────

export async function insertAutoQuery(q: {
  query_id: string;
  query_type: string;
  market_pda?: string | null;
  config: unknown;
  status: string;
  created_at: bigint;
  expires_at?: bigint | null;
}) {
  await sql`
    INSERT INTO auto_queries ${sql({
      query_id: q.query_id,
      query_type: q.query_type,
      market_pda: q.market_pda ?? null,
      config: q.config as any,
      status: q.status,
      created_at: q.created_at,
      expires_at: q.expires_at ?? null,
    } as any)}
    ON CONFLICT (query_id) DO NOTHING
  `;
}

export async function getAutoQuery(queryId: string) {
  const [row] = await sql<AutoQueryRow[]>`
    SELECT * FROM auto_queries WHERE query_id = ${queryId}
  `;
  return row;
}

/** Insert a synthetic failed-watcher record for observability when create fails. */
export async function insertFailedAutoQuery(opts: {
  market_pda: string;
  query_type: string;
  config: unknown;
  error_reason: string;
}) {
  const fakeQueryId = `failed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO auto_queries ${sql({
      query_id: fakeQueryId,
      query_type: opts.query_type,
      market_pda: opts.market_pda,
      config: opts.config as any,
      status: "failed",
      created_at: BigInt(Date.now()),
      expires_at: null,
      error_reason: opts.error_reason.slice(0, 1000),
    } as any)}
    ON CONFLICT (query_id) DO NOTHING
  `;
}

export async function listAutoQueries(opts: {
  status?: AutoQueryRow["status"];
  marketPda?: string;
  limit?: number;
}) {
  const limit = opts.limit ?? 100;
  if (opts.status && opts.marketPda) {
    return sql<AutoQueryRow[]>`
      SELECT * FROM auto_queries
      WHERE status = ${opts.status} AND market_pda = ${opts.marketPda}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
  }
  if (opts.status) {
    return sql<AutoQueryRow[]>`
      SELECT * FROM auto_queries WHERE status = ${opts.status}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
  }
  if (opts.marketPda) {
    return sql<AutoQueryRow[]>`
      SELECT * FROM auto_queries WHERE market_pda = ${opts.marketPda}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
  }
  return sql<AutoQueryRow[]>`
    SELECT * FROM auto_queries ORDER BY created_at DESC LIMIT ${limit}
  `;
}

export async function getAutoQueriesExpiringSoon(withinMs: number) {
  const threshold = BigInt(Date.now() + withinMs);
  return sql<AutoQueryRow[]>`
    SELECT * FROM auto_queries
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ${threshold}
  `;
}

export async function autoEventExists(eventId: string): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM auto_events WHERE event_id = ${eventId}`;
  return !!row;
}

export async function insertAutoEvent(e: {
  event_id: string;
  query_id: string;
  channel: string;
  payload: unknown;
  received_at: bigint;
}) {
  await sql`
    INSERT INTO auto_events ${sql(e as unknown as Record<string, unknown>)}
    ON CONFLICT (event_id) DO NOTHING
  `;
}

export async function markAutoEventProcessed(eventId: string, outcome: string) {
  await sql`
    UPDATE auto_events SET processed_at = ${BigInt(Date.now())}, outcome = ${outcome}
    WHERE event_id = ${eventId}
  `;
}

// ── Market candidates (AI gating audit log) ──────────────────────────────

/**
 * Lookup a recent decision for the same raw input within `withinMs`.
 * Lets the poller skip re-judging the same narrative/token every cycle.
 */
export async function getRecentCandidateDecision(
  sourceKind: MarketCandidateRow["source_kind"],
  sourceKey: string,
  withinMs: number,
): Promise<MarketCandidateRow | undefined> {
  const cutoff = BigInt(Date.now() - withinMs);
  const [row] = await sql<MarketCandidateRow[]>`
    SELECT * FROM market_candidates
    WHERE source_kind = ${sourceKind}
      AND source_key = ${sourceKey}
      AND created_at >= ${cutoff}
    ORDER BY created_at DESC LIMIT 1
  `;
  return row;
}

export async function insertMarketCandidate(c: {
  source_kind: MarketCandidateRow["source_kind"];
  source_key: string;
  raw_input: unknown;
  verdict: MarketCandidateRow["verdict"];
  ai_identifier?: string | null;
  ai_display_name?: string | null;
  ai_asset_class?: number | null;
  ai_confidence_bps?: number | null;
  ai_reason?: string | null;
  ai_model?: string | null;
  merged_with?: string | null;
  spawn_market_pda?: string | null;
  decided_at?: bigint | null;
}): Promise<bigint> {
  const now = BigInt(Date.now());
  const [row] = await sql<{ id: bigint }[]>`
    INSERT INTO market_candidates ${sql({
      source_kind: c.source_kind,
      source_key: c.source_key,
      raw_input: c.raw_input as any,
      verdict: c.verdict,
      ai_identifier: c.ai_identifier ?? null,
      ai_display_name: c.ai_display_name ?? null,
      ai_asset_class: c.ai_asset_class ?? null,
      ai_confidence_bps: c.ai_confidence_bps ?? null,
      ai_reason: c.ai_reason?.slice(0, 500) ?? null,
      ai_model: c.ai_model ?? null,
      merged_with: c.merged_with ?? null,
      spawn_market_pda: c.spawn_market_pda ?? null,
      created_at: now,
      decided_at: c.decided_at ?? now,
    } as any)}
    RETURNING id
  `;
  return row.id;
}

export async function updateCandidateVerdict(
  id: bigint,
  verdict: MarketCandidateRow["verdict"],
  spawnMarketPda?: string | null,
) {
  await sql`
    UPDATE market_candidates
    SET verdict = ${verdict},
        spawn_market_pda = COALESCE(${spawnMarketPda ?? null}, spawn_market_pda),
        decided_at = ${BigInt(Date.now())}
    WHERE id = ${id}
  `;
}

export async function listMarketCandidates(opts: {
  verdict?: MarketCandidateRow["verdict"];
  limit?: number;
}) {
  const limit = opts.limit ?? 100;
  if (opts.verdict) {
    return sql<MarketCandidateRow[]>`
      SELECT * FROM market_candidates WHERE verdict = ${opts.verdict}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
  }
  return sql<MarketCandidateRow[]>`
    SELECT * FROM market_candidates ORDER BY created_at DESC LIMIT ${limit}
  `;
}

export async function getMarketCandidate(id: bigint) {
  const [row] = await sql<MarketCandidateRow[]>`
    SELECT * FROM market_candidates WHERE id = ${id}
  `;
  return row;
}

// ── Link cache ───────────────────────────────────────────────────────────

export async function getLinkCache(url: string) {
  const [row] = await sql<LinkCacheRow[]>`SELECT * FROM link_cache WHERE url = ${url}`;
  return row;
}

export async function cacheLinkResolution(
  url: string,
  platform: string,
  metadata: unknown,
  extractedSymbol?: string | null,
) {
  const now = BigInt(Date.now());
  const ttl = 86_400_000n;
  await sql`
    INSERT INTO link_cache ${sql({
      url,
      platform,
      metadata: metadata as any,
      extracted_symbol: extractedSymbol ?? null,
      resolved_at: now,
      expires_at: now + ttl,
    } as any)}
    ON CONFLICT (url) DO UPDATE SET
      platform = EXCLUDED.platform, metadata = EXCLUDED.metadata,
      extracted_symbol = EXCLUDED.extracted_symbol,
      resolved_at = EXCLUDED.resolved_at, expires_at = EXCLUDED.expires_at
  `;
}

// ── Elfa trend cache ────────────────────────────────────────────────────

export async function getElfaTrendCache(key: string) {
  const [row] = await sql<{ data: unknown; fetched_at: bigint }[]>`
    SELECT data, fetched_at FROM elfa_trend_cache WHERE cache_key = ${key}
  `;
  return row;
}

export async function setElfaTrendCache(key: string, data: unknown) {
  await sql`
    INSERT INTO elfa_trend_cache ${sql({
      cache_key: key,
      data: data as any,
      fetched_at: BigInt(Date.now()),
    } as any)}
    ON CONFLICT (cache_key) DO UPDATE SET
      data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at
  `;
}
