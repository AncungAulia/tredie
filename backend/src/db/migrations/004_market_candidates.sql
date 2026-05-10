-- AI-gated market spawn pipeline.
-- Every candidate from Elfa polling (narratives, tokens, CAs) is logged here
-- before being spawned. Gemini judges hype quality + canonical naming.

CREATE TABLE IF NOT EXISTS market_candidates (
  id                 BIGSERIAL PRIMARY KEY,
  source_kind        TEXT    NOT NULL CHECK (source_kind IN
                       ('narrative','token','ca_twitter','ca_telegram','user_search','user_link_paste')),
  source_key         TEXT    NOT NULL,
  raw_input          JSONB   NOT NULL,
  verdict            TEXT    NOT NULL CHECK (verdict IN
                       ('pending','spawn','skip','merge','manual_approve','manual_reject','spawn_failed')),
  ai_identifier      TEXT,
  ai_display_name    TEXT,
  ai_asset_class     SMALLINT,
  ai_confidence_bps  INTEGER,
  ai_reason          TEXT,
  ai_model           TEXT,
  merged_with        TEXT,
  spawn_market_pda   TEXT    REFERENCES markets(pda) ON DELETE SET NULL,
  created_at         BIGINT  NOT NULL,
  decided_at         BIGINT
);

CREATE INDEX IF NOT EXISTS idx_market_candidates_verdict
  ON market_candidates(verdict, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_candidates_recent
  ON market_candidates(source_kind, source_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_candidates_identifier
  ON market_candidates(ai_identifier);
