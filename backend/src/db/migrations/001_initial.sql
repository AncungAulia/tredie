-- ── Markets (mirror on-chain Market PDA) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id                       BIGSERIAL PRIMARY KEY,
  pda                      TEXT    UNIQUE NOT NULL,
  mint                     TEXT    UNIQUE NOT NULL,
  identifier               TEXT    UNIQUE NOT NULL,
  asset_class              SMALLINT NOT NULL CHECK (asset_class BETWEEN 0 AND 5),
  -- 0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA
  display_name             TEXT,
  description              TEXT,
  image_url                TEXT,
  source_url               TEXT,
  source_metadata          JSONB,
  base_virtual_sol         BIGINT  NOT NULL,
  virtual_token_supply     BIGINT  NOT NULL,
  real_sol_reserves        BIGINT  NOT NULL DEFAULT 0,
  tokens_minted            BIGINT  NOT NULL DEFAULT 0,
  current_mindshare_bps    INTEGER NOT NULL DEFAULT 0,
  peak_mindshare_bps       INTEGER NOT NULL DEFAULT 0,
  ratchet_multiplier_bps   INTEGER NOT NULL DEFAULT 10000,
  creator_pubkey           TEXT    NOT NULL,
  creator_source           TEXT    NOT NULL DEFAULT 'auto_spawn'
                            CHECK (creator_source IN ('auto_spawn','user_search','user_link_paste')),
  created_at               BIGINT  NOT NULL,
  last_synced_slot         BIGINT  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_markets_asset_class ON markets(asset_class);
CREATE INDEX IF NOT EXISTS idx_markets_mindshare   ON markets(current_mindshare_bps DESC);
CREATE INDEX IF NOT EXISTS idx_markets_creator     ON markets(creator_pubkey);

-- ── Trades (diisi oleh trade-indexer dari Helius webhook) ────────────────
CREATE TABLE IF NOT EXISTS trades (
  id           BIGSERIAL PRIMARY KEY,
  signature    TEXT    UNIQUE NOT NULL,
  market_pda   TEXT    NOT NULL REFERENCES markets(pda) ON DELETE CASCADE,
  side         SMALLINT NOT NULL CHECK (side IN (0, 1)),
  trader       TEXT    NOT NULL,
  sol_amount   BIGINT  NOT NULL,
  token_amount BIGINT  NOT NULL,
  ratchet_bps  INTEGER NOT NULL,
  block_time   BIGINT  NOT NULL,
  slot         BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_market     ON trades(market_pda);
CREATE INDEX IF NOT EXISTS idx_trades_block_time ON trades(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader     ON trades(trader);

-- ── Mindshare history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mindshare_history (
  id           BIGSERIAL PRIMARY KEY,
  market_pda   TEXT    NOT NULL REFERENCES markets(pda) ON DELETE CASCADE,
  current_bps  INTEGER NOT NULL,
  peak_bps     INTEGER NOT NULL,
  ratchet_bps  INTEGER NOT NULL,
  source       TEXT    NOT NULL CHECK (source IN ('rest_poll','auto_event','manual')),
  recorded_at  BIGINT  NOT NULL,
  tx_signature TEXT
);

CREATE INDEX IF NOT EXISTS idx_mindshare_market ON mindshare_history(market_pda, recorded_at DESC);

-- ── Trending tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_tokens (
  id            BIGSERIAL PRIMARY KEY,
  symbol        TEXT    NOT NULL,
  mention_count INTEGER NOT NULL,
  mindshare_pct DOUBLE PRECISION,
  rank_position INTEGER,
  fetched_at    BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trending_tokens_fetched ON trending_tokens(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_tokens_symbol  ON trending_tokens(symbol, fetched_at DESC);

-- ── Trending CAs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_cas (
  id               BIGSERIAL PRIMARY KEY,
  contract_address TEXT    NOT NULL,
  source_platform  TEXT    NOT NULL CHECK (source_platform IN ('twitter','telegram')),
  mention_count    INTEGER NOT NULL,
  rank_position    INTEGER,
  fetched_at       BIGINT  NOT NULL,
  UNIQUE(contract_address, source_platform, fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_trending_cas_fetched  ON trending_cas(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_cas_platform ON trending_cas(source_platform);

-- ── Token metadata ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_metadata (
  contract_address TEXT    PRIMARY KEY,
  symbol           TEXT,
  name             TEXT,
  image_url        TEXT,
  decimals         SMALLINT,
  total_supply     TEXT,
  source           TEXT    CHECK (source IN ('helius_das','jupiter','manual')),
  fetched_at       BIGINT  NOT NULL
);

-- ── Auto queries ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_queries (
  id          BIGSERIAL PRIMARY KEY,
  query_id    TEXT    UNIQUE NOT NULL,
  query_type  TEXT    NOT NULL,
  market_pda  TEXT    REFERENCES markets(pda) ON DELETE SET NULL,
  config      JSONB   NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','cancelled','expired')),
  created_at  BIGINT  NOT NULL,
  expires_at  BIGINT
);

CREATE INDEX IF NOT EXISTS idx_auto_queries_status ON auto_queries(status, expires_at);

-- ── Auto events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_events (
  id           BIGSERIAL PRIMARY KEY,
  event_id     TEXT    UNIQUE NOT NULL,
  query_id     TEXT    NOT NULL,
  channel      TEXT    NOT NULL,
  payload      JSONB   NOT NULL,
  received_at  BIGINT  NOT NULL,
  processed_at BIGINT,
  outcome      TEXT
);

CREATE INDEX IF NOT EXISTS idx_auto_events_query ON auto_events(query_id);

-- ── Link cache ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS link_cache (
  url              TEXT    PRIMARY KEY,
  platform         TEXT    NOT NULL,
  metadata         JSONB   NOT NULL,
  extracted_symbol TEXT,
  resolved_at      BIGINT  NOT NULL,
  expires_at       BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_cache_expires ON link_cache(expires_at);

-- ── Elfa REST trend cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elfa_trend_cache (
  cache_key   TEXT    PRIMARY KEY,
  data        JSONB   NOT NULL,
  fetched_at  BIGINT  NOT NULL
);

-- ── Realtime publication (idempotent) ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'markets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE markets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trades;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mindshare_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mindshare_history;
  END IF;
END
$$;
