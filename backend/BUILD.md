# Tredie Backend — BUILD.md

Panduan implementasi lengkap backend Tredie. Backend ini bertindak sebagai jembatan
**Orakel** antara Elfa AI (data sosial), Solana devnet (program Anchor `tredie`), dan
frontend (Next.js). Semua state, cache, dan fan-out real-time ke frontend ditangani
oleh **Supabase (Postgres + Realtime)**.

## Konsep produk

Tredie adalah **attention tokenization layer** — setiap "trend" (entitas yang lagi
mendapat perhatian) bisa di-mint jadi market on-chain dengan AMM curve, dan user bisa
trade attention token tersebut. "Trend" disini didefinisikan luas: bisa berupa crypto
ticker, contract address Solana, equity/commodity, **atau topik kultural seperti
"chinese baddies", "labubu", "ai agents"**.

Mirip Zora secara primitif (anyone can tokenize anything + AMM), tapi ekspansinya
ke **attention-level**: lo gak speculate sama 1 post, lo speculate sama gelombang
attention itu sendiri.

**Asset class on-chain:**

| Class | Identifier convention | Contoh | Discovery primitive |
|---|---|---|---|
| 0 = crypto | Plain ticker | `BTC`, `BONK` | Elfa `trending-tokens` |
| 1 = dex | Plain ticker | `JUP` | Elfa `trending-tokens` |
| 2-4 = equity/commodity/fx | `xyz:` prefix (HIP-3) | `xyz:NVDA`, `xyz:XAU` | Elfa `top-mentions` |
| 5 = CA | Solana base58 | `So11111111111111111111111111111111111111112` | Elfa `trending-cas/{platform}` |
| **6 = trend** | **`trend:` prefix + slug** | **`trend:chinese-baddies`** | **Elfa `trending-narratives` + `keyword-mentions`** |

> Smart contract sudah di-deploy:
> - Devnet: `EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU`
> - Localnet: `4FCfLbAUvwhXKHsaSUyZBEL9Va1cowM72naFiuSNQB3Z`
> - Source: `/programs/programs/tredie/src` — instructions: `init_factory`, `create_market`, `buy`, `sell`, `update_mindshare`

---

## Daftar Isi

1. [Tech Stack & Versions](#1-tech-stack--versions)
2. [Prerequisites](#2-prerequisites)
3. [Setup Awal](#3-setup-awal)
4. [Struktur Folder](#4-struktur-folder)
5. [Environment Variables](#5-environment-variables)
6. [Database (Supabase Postgres + Realtime)](#6-database-supabase-postgres--realtime)
7. [Solana Integration](#7-solana-integration)
8. [Elfa AI Client](#8-elfa-ai-client)
9. [Services](#9-services)
10. [API Routes (Hono)](#10-api-routes-hono)
11. [Queue](#11-queue)
12. [Phase Build Order](#12-phase-build-order)
13. [Scripts](#13-scripts)
14. [Error Handling & Logging](#14-error-handling--logging)

---

## 1. Tech Stack & Versions

| Layer            | Tech                          | Version              |
| ---------------- | ----------------------------- | -------------------- |
| Runtime          | Bun                           | latest               |
| Framework        | Hono                          | 4.x                  |
| Language         | TypeScript                    | 5.x                  |
| Database         | Supabase (Postgres 15)        | latest               |
| Realtime         | Supabase Realtime             | bawaan Supabase      |
| DB driver        | `postgres` (porsager)         | 3.x                  |
| Logging          | pino + pino-pretty            | latest               |
| Solana SDK       | @solana/web3.js               | 1.x (legacy, stable) |
| Anchor client    | @coral-xyz/anchor             | 0.30.x               |
| Queue            | in-memory + audit di Postgres | —                    |
| HTTP client      | ky                            | latest               |
| Scheduling       | node-cron                     | latest               |
| Validation       | zod                           | 3.x                  |

**Catatan stack:**

- **Backend pakai `postgres` (porsager)**, bukan `@supabase/supabase-js`. Service role key
  cuma dipakai untuk konfigurasi awal; runtime traffic pakai connection-string langsung
  agar tagged-template SQL clean dan tipe-aman.
- **Frontend pakai `@supabase/supabase-js`** untuk subscribe Realtime ke tabel `markets`,
  `trades`, dan `mindshare_history`. Backend cuma `INSERT/UPDATE`, broadcast otomatis lewat
  WAL publication.
- `@solana/web3.js` v1 (bukan kit) supaya kompatibel dengan `@coral-xyz/anchor`. Frontend
  boleh pakai kit kalau mau.
- Hono cocok dengan Bun runtime, edge-deployable (Vercel/Cloudflare Workers), dan `c.req.text()`
  bikin verifikasi HMAC dengan raw body trivial.

---

## 2. Prerequisites

```bash
# Pastikan sudah ada:
bun --version          # >= 1.1.0
solana --version       # >= 3.0.0 (untuk generate signer keypair)

# Akun & API keys yang dibutuhkan:
# - Supabase project (gratis): https://supabase.com  → ambil DATABASE_URL + SERVICE_ROLE_KEY
# - Helius API key + Webhook secret (devnet): https://dev.helius.xyz
# - Elfa API key + API secret + Auto webhook secret: https://dev.elfa.ai
```

---

## 3. Setup Awal

```bash
cd tredie/backend

# Init project
bun init -y

# Core deps
bun add hono
bun add postgres
bun add @supabase/supabase-js          # only for utility scripts (e.g. migrate)
bun add @solana/web3.js @coral-xyz/anchor bs58
bun add @solana/spl-token
bun add ky zod dotenv node-cron pino pino-pretty

# Dev deps
bun add -d typescript @types/node @types/node-cron @types/bs58 tsx
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `package.json` scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun src/index.ts",
    "db:migrate": "tsx src/db/migrate.ts",
    "oracle:update": "tsx src/scripts/manual-oracle-update.ts",
    "market:spawn": "tsx src/scripts/spawn-market.ts",
    "factory:init": "tsx src/scripts/init-factory.ts",
    "seed": "tsx src/scripts/seed-markets.ts"
  }
}
```

---

## 4. Struktur Folder

```
backend/
├── BUILD.md                    ← dokumen ini
├── package.json
├── tsconfig.json
├── .env.example
├── .env                        ← TIDAK di-commit
└── src/
    ├── index.ts                ← Hono entry point + service bootstrap
    ├── config.ts               ← load & validate env (zod)
    ├── db/
    │   ├── index.ts            ← postgres client + helper queries
    │   ├── migrate.ts          ← jalankan migrations
    │   └── migrations/
    │       └── 001_initial.sql
    ├── elfa/
    │   ├── client.ts           ← REST client (trending, top-mentions, chat)
    │   ├── auto-client.ts      ← Auto API client (HMAC signed)
    │   └── types.ts
    ├── solana/
    │   ├── connection.ts
    │   ├── signer.ts
    │   ├── pda.ts
    │   ├── instructions.ts     ← raw IX builder (Anchor discriminator-based)
    │   └── decoder.ts          ← parse Anchor event logs dari Helius webhook
    ├── services/
    │   ├── trending-poller.ts
    │   ├── market-spawner.ts
    │   ├── oracle-updater.ts
    │   ├── auto-manager.ts
    │   ├── metadata-enricher.ts
    │   ├── link-resolver.ts
    │   ├── symbol-extractor.ts
    │   └── trade-indexer.ts    ← parse Helius trades → DB (memicu Realtime)
    ├── api/
    │   ├── routes.ts           ← register Hono routes
    │   ├── markets.ts
    │   ├── trending.ts
    │   ├── search.ts
    │   ├── resolve-link.ts
    │   ├── webhooks.ts         ← /api/webhooks/elfa, /api/webhooks/helius
    │   └── health.ts
    ├── queue/
    │   └── index.ts            ← in-memory queue + Postgres audit
    ├── utils/
    │   ├── hmac.ts
    │   ├── log.ts
    │   └── sleep.ts
    └── scripts/
        ├── init-factory.ts
        ├── manual-oracle-update.ts
        ├── spawn-market.ts
        └── seed-markets.ts
```

---

## 5. Environment Variables

### `.env.example`

```bash
# ── Server ─────────────────────────────────────────────────────────────────
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# ── Supabase ───────────────────────────────────────────────────────────────
# Connection string dari Supabase dashboard → Settings → Database → "Connection string" (URI)
# Pastikan pakai pooler (port 6543 / pgbouncer) bukan direct (port 5432) di prod.
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...

# ── Solana ─────────────────────────────────────────────────────────────────
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
SOLANA_NETWORK=devnet
TREDIE_PROGRAM_ID=EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU

# Backend signer: array JSON dari `solana-keygen new --outfile backend-signer.json`
# Wallet ini menjadi: oracle authority (update_mindshare), market creator (auto-spawn),
# fee payer untuk semua tx yang dipicu backend.
SIGNER_PRIVATE_KEY=[1,2,3,...,64]

HELIUS_API_KEY=YOUR_HELIUS_KEY
HELIUS_WEBHOOK_SECRET=YOUR_HELIUS_WEBHOOK_SECRET

# ── Elfa ───────────────────────────────────────────────────────────────────
ELFA_API_KEY=YOUR_ELFA_API_KEY
ELFA_API_SECRET=YOUR_ELFA_API_SECRET
ELFA_API_BASE=https://api.elfa.ai
ELFA_AUTO_WEBHOOK_SECRET=YOUR_ELFA_AUTO_WEBHOOK_SECRET

# ── Frontend ────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# ── Thresholds ──────────────────────────────────────────────────────────────
AUTO_SPAWN_THRESHOLD_PCT=0.5      # spawn market jika mindshare > 0.5%
CA_SPAWN_THRESHOLD=500            # spawn CA market jika mention_count > 500
HYPE_EVENT_PREMIUM_BPS=500        # boost mindshare saat hype event Auto
```

### `src/config.ts`

```typescript
import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.string().default("4000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta", "localnet"]).default("devnet"),
  TREDIE_PROGRAM_ID: z.string(),
  SIGNER_PRIVATE_KEY: z.string(),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_SECRET: z.string().default(""),

  ELFA_API_KEY: z.string(),
  ELFA_API_SECRET: z.string().default(""),
  ELFA_API_BASE: z.string().url().default("https://api.elfa.ai"),
  ELFA_AUTO_WEBHOOK_SECRET: z.string().default(""),

  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BACKEND_URL: z.string().default("http://localhost:4000"),

  AUTO_SPAWN_THRESHOLD_PCT: z.string().default("0.5").transform(Number),
  CA_SPAWN_THRESHOLD: z.string().default("500").transform(Number),
  HYPE_EVENT_PREMIUM_BPS: z.string().default("500").transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid env:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

---

## 6. Database (Supabase Postgres + Realtime)

Buat project gratis di Supabase, lalu copy `DATABASE_URL`, `SUPABASE_URL`, dan
`SUPABASE_SERVICE_ROLE_KEY` ke `.env`.

### `src/db/migrations/001_initial.sql`

Skema lengkap untuk MVP. Semua amount on-chain pakai `BIGINT` (u64 lamports/tokens muat).
Timestamps app-level pakai `BIGINT` epoch-ms supaya konsisten dengan `Date.now()` di TS.
JSON pakai `JSONB` (indexable + native operators).

```sql
-- ── Markets (mirror on-chain Market PDA) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id                       BIGSERIAL PRIMARY KEY,
  pda                      TEXT    UNIQUE NOT NULL,
  mint                     TEXT    UNIQUE NOT NULL,
  identifier               TEXT    UNIQUE NOT NULL,
  asset_class              SMALLINT NOT NULL CHECK (asset_class BETWEEN 0 AND 6),
  -- 0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA 6=trend
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
  side         SMALLINT NOT NULL CHECK (side IN (0, 1)), -- 0=buy 1=sell
  trader       TEXT    NOT NULL,
  sol_amount   BIGINT  NOT NULL,
  token_amount BIGINT  NOT NULL,
  ratchet_bps  INTEGER NOT NULL,
  block_time   BIGINT  NOT NULL,  -- unix epoch (seconds, dari Solana clock)
  slot         BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_market     ON trades(market_pda);
CREATE INDEX IF NOT EXISTS idx_trades_block_time ON trades(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader     ON trades(trader);

-- ── Mindshare history (untuk grafik di frontend) ─────────────────────────
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

-- ── Trending tokens cache (Elfa REST poll) ───────────────────────────────
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

-- ── Trending CAs cache ───────────────────────────────────────────────────
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

-- ── Token metadata cache (untuk CAs) ─────────────────────────────────────
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

-- ── Auto queries (Elfa Auto subscriptions) ───────────────────────────────
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

-- ── Auto events (raw + idempotent dedup) ─────────────────────────────────
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

-- ── Link cache (paste-link → metadata + extracted symbol) ────────────────
CREATE TABLE IF NOT EXISTS link_cache (
  url              TEXT    PRIMARY KEY,
  platform         TEXT    NOT NULL,
  metadata         JSONB   NOT NULL,
  extracted_symbol TEXT,
  resolved_at      BIGINT  NOT NULL,
  expires_at       BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_cache_expires ON link_cache(expires_at);

-- ── Elfa REST trend cache (15-menit cache, key per (identifier, kind)) ──
CREATE TABLE IF NOT EXISTS elfa_trend_cache (
  cache_key   TEXT    PRIMARY KEY,        -- e.g. "trending-tokens:1h" atau "top-mentions:BTC:1h"
  data        JSONB   NOT NULL,
  fetched_at  BIGINT  NOT NULL
);

-- ── Realtime publication ────────────────────────────────────────────────
-- Frontend subscribe ke tabel ini via @supabase/supabase-js .channel().on('postgres_changes',...)
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE mindshare_history;
```

### `src/db/migrate.ts`

```typescript
import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "../config";

const sql = postgres(config.DATABASE_URL, {
  ssl: "require",
  max: 1,
});

async function migrate() {
  const dir = join(import.meta.dir, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    console.log(`Running ${file}...`);
    const ddl = readFileSync(join(dir, file), "utf-8");
    await sql.unsafe(ddl);
  }
  console.log("✅ Migrations complete");
  await sql.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### `src/db/index.ts`

```typescript
import postgres from "postgres";
import { config } from "../config";

export const sql = postgres(config.DATABASE_URL, {
  ssl: "require",
  // Pooler Supabase sudah handle pooling; cap koneksi dari client
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // postgres.js return BIGINT sebagai string secara default. Untuk amount lamports/u64
  // kita serialize sebagai string di JSON response (BigInt JSON.stringify aman).
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
  status: "active" | "cancelled" | "expired";
  created_at: bigint;
  expires_at: bigint | null;
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
      source_metadata: m.source_metadata ?? null,
      base_virtual_sol: m.base_virtual_sol,
      virtual_token_supply: m.virtual_token_supply,
      real_sol_reserves: m.real_sol_reserves ?? 0n,
      tokens_minted: m.tokens_minted ?? 0n,
      creator_pubkey: m.creator_pubkey,
      creator_source: m.creator_source,
      created_at: m.created_at,
      last_synced_slot: m.last_synced_slot ?? 0n,
    })}
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
      config: q.config,
      status: q.status,
      created_at: q.created_at,
      expires_at: q.expires_at ?? null,
    })}
    ON CONFLICT (query_id) DO NOTHING
  `;
}

export async function getAutoQuery(queryId: string) {
  const [row] = await sql<AutoQueryRow[]>`
    SELECT * FROM auto_queries WHERE query_id = ${queryId}
  `;
  return row;
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
      metadata,
      extracted_symbol: extractedSymbol ?? null,
      resolved_at: now,
      expires_at: now + ttl,
    })}
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
      data,
      fetched_at: BigInt(Date.now()),
    })}
    ON CONFLICT (cache_key) DO UPDATE SET
      data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at
  `;
}
```

> **JSON serialization tip**: BigInt tidak bisa langsung `JSON.stringify`. Sebelum
> kirim response, convert via `BigInt.prototype.toString` atau pakai response helper:
> ```ts
> export function jsonSafe<T>(v: T): T {
>   return JSON.parse(JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x));
> }
> ```
> Atau set Hono response: `return c.json(jsonSafe(data))`.

---

## 7. Solana Integration

Program sudah deploy di devnet. Backend hanya perlu **build + sign + send** instruction
untuk: `init_factory` (sekali, via script), `create_market` (auto-spawn), `update_mindshare`
(cron). Untuk `buy`/`sell`, backend cuma siapkan unsigned tx (frontend yang sign).

### `src/solana/connection.ts`

```typescript
import { Connection } from "@solana/web3.js";
import { config } from "../config";

export const connection = new Connection(config.SOLANA_RPC_URL, "confirmed");
```

### `src/solana/signer.ts`

```typescript
import { Keypair } from "@solana/web3.js";
import { config } from "../config";

function loadSigner(): Keypair {
  try {
    const arr = JSON.parse(config.SIGNER_PRIVATE_KEY) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    throw new Error("SIGNER_PRIVATE_KEY must be a JSON array of 64 numbers");
  }
}

export const signer = loadSigner();
```

### `src/solana/pda.ts`

PDA seeds dari `programs/programs/tredie/src/constants.rs`:

```typescript
import { PublicKey } from "@solana/web3.js";
import { config } from "../config";

const PROGRAM_ID = new PublicKey(config.TREDIE_PROGRAM_ID);

const FACTORY_SEED = Buffer.from("factory");
const MARKET_SEED  = Buffer.from("market");
const ORACLE_SEED  = Buffer.from("oracle");

export const programId = PROGRAM_ID;

export function factoryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FACTORY_SEED], PROGRAM_ID);
}

/** Identifier: padded ke 32 bytes dengan zero. */
export function identifierToBytes(identifier: string): Buffer {
  const bytes = Buffer.from(identifier, "utf-8");
  if (bytes.length === 0 || bytes.length > 32) {
    throw new Error(`Identifier "${identifier}" must be 1..32 UTF-8 bytes`);
  }
  const padded = Buffer.alloc(32, 0);
  bytes.copy(padded);
  return padded;
}

export function identifierByteLen(identifier: string): number {
  return Buffer.from(identifier, "utf-8").length;
}

export function marketPda(identifier: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, identifierToBytes(identifier)],
    PROGRAM_ID,
  );
}

export function oraclePda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ORACLE_SEED, market.toBuffer()], PROGRAM_ID);
}
```

### `src/solana/instructions.ts`

Anchor instruction discriminator = `sha256("global:<snake_case_name>")[..8]`. Argument
encoding pakai borsh-compatible little-endian (manual untuk hindari overhead Anchor IDL).

```typescript
import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { connection } from "./connection";
import { signer } from "./signer";
import {
  factoryPda,
  marketPda,
  oraclePda,
  identifierToBytes,
  identifierByteLen,
  programId,
} from "./pda";

function disc(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u16LE(n: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32LE(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function u64LE(n: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; }

// ── init_factory(fee_basis_points: u16) — dipanggil sekali via script ────
export async function buildInitFactoryTx(opts: {
  feeRecipient: PublicKey;
  feeBasisPoints: number;
}): Promise<Transaction> {
  const [factory] = factoryPda();
  const data = Buffer.concat([disc("init_factory"), u16LE(opts.feeBasisPoints)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
      { pubkey: opts.feeRecipient, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── create_market(identifier, identifier_len, asset_class, base_virtual_sol,
//                  virtual_token_supply, elasticity_bps) ───────────────────
export async function buildCreateMarketTx(opts: {
  identifier: string;
  assetClass: number;
  mintKeypairPubkey: PublicKey;
  oracleAuthority: PublicKey;
  baseVirtualSol?: bigint;
  virtualTokenSupply?: bigint;
  elasticityBps?: number;
}): Promise<Transaction> {
  const {
    identifier,
    assetClass,
    mintKeypairPubkey,
    oracleAuthority,
    baseVirtualSol = 30_000_000_000n,
    virtualTokenSupply = 1_000_000_000_000_000n,
    elasticityBps = 5000,
  } = opts;

  const idBytes = identifierToBytes(identifier);
  const idLen = identifierByteLen(identifier);

  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);

  const data = Buffer.concat([
    disc("create_market"),
    idBytes,                          // [u8; 32]
    Buffer.from([idLen]),             // u8
    Buffer.from([assetClass]),        // u8
    u64LE(baseVirtualSol),
    u64LE(virtualTokenSupply),
    u32LE(elasticityBps),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintKeypairPubkey, isSigner: true, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },        // creator
      { pubkey: oracleAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── update_mindshare(new_mindshare_bps: u32) ─────────────────────────────
export async function buildUpdateMindshareTx(opts: {
  identifier: string;
  newMindshareBps: number;
}): Promise<Transaction> {
  const [market] = marketPda(opts.identifier);
  const [oracle] = oraclePda(market);

  const data = Buffer.concat([disc("update_mindshare"), u32LE(opts.newMindshareBps)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: market, isSigner: false, isWritable: false },
      { pubkey: oracle, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── buy(sol_amount_in: u64, min_tokens_out: u64) — unsigned utk frontend ─
export async function buildBuyTx(opts: {
  buyer: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  solAmountIn: bigint;
  minTokensOut: bigint;
}): Promise<Transaction> {
  const { buyer, identifier, mintPubkey, solAmountIn, minTokensOut } = opts;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);
  const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyer);

  // factory.fee_recipient ada di offset: 8 (disc) + 1 (bump) + 32 (authority) = 41
  const factoryAcc = await connection.getAccountInfo(factory);
  if (!factoryAcc) throw new Error("Factory account not found — run init_factory first");
  const feeRecipient = new PublicKey(factoryAcc.data.subarray(41, 73));

  const data = Buffer.concat([disc("buy"), u64LE(solAmountIn), u64LE(minTokensOut)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: false },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = buyer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── sell(tokens_in: u64, min_sol_out: u64) ───────────────────────────────
export async function buildSellTx(opts: {
  seller: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  tokensIn: bigint;
  minSolOut: bigint;
}): Promise<Transaction> {
  const { seller, identifier, mintPubkey, tokensIn, minSolOut } = opts;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);
  const sellerAta = await getAssociatedTokenAddress(mintPubkey, seller);

  const factoryAcc = await connection.getAccountInfo(factory);
  if (!factoryAcc) throw new Error("Factory account not found");
  const feeRecipient = new PublicKey(factoryAcc.data.subarray(41, 73));

  const data = Buffer.concat([disc("sell"), u64LE(tokensIn), u64LE(minSolOut)]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: factory, isSigner: false, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: oracle, isSigner: false, isWritable: false },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = seller;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

// ── send + confirm (backend-signed only) ─────────────────────────────────
export async function sendAndConfirm(
  tx: Transaction,
  additionalSigners: Keypair[] = [],
): Promise<string> {
  tx.sign(signer, ...additionalSigners);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
```

### `src/solana/decoder.ts`

Parse Anchor event log dari Helius webhook. Anchor emit event sebagai program log:
`Program data: <base64 disc[8] || borsh-encoded fields>`. Untuk MVP cukup parse `Trade`
event untuk indexing.

```typescript
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const TRADE_DISC = createHash("sha256").update("event:Trade").digest().subarray(0, 8);

export interface TradeEvent {
  market: string;
  side: 0 | 1;
  solAmount: bigint;
  tokenAmount: bigint;
  ratchetBps: number;
  trader: string;
  timestamp: bigint;
}

/** Parse "Program data:" log lines untuk Trade event. */
export function parseTradeEvents(logs: string[]): TradeEvent[] {
  const events: TradeEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith("Program data: ")) continue;
    const b64 = line.slice("Program data: ".length).trim();
    let buf: Buffer;
    try { buf = Buffer.from(b64, "base64"); } catch { continue; }
    if (buf.length < 8) continue;
    if (!buf.subarray(0, 8).equals(TRADE_DISC)) continue;

    let off = 8;
    const market = new PublicKey(buf.subarray(off, off + 32)); off += 32;
    const side = buf.readUInt8(off); off += 1;
    const solAmount = buf.readBigUInt64LE(off); off += 8;
    const tokenAmount = buf.readBigUInt64LE(off); off += 8;
    const ratchetBps = buf.readUInt32LE(off); off += 4;
    const trader = new PublicKey(buf.subarray(off, off + 32)); off += 32;
    const timestamp = buf.readBigInt64LE(off);

    events.push({
      market: market.toBase58(),
      side: (side === 0 ? 0 : 1),
      solAmount,
      tokenAmount,
      ratchetBps,
      trader: trader.toBase58(),
      timestamp,
    });
  }
  return events;
}
```

---

## 8. Elfa AI Client

### `src/elfa/types.ts`

> Wire-level shapes match `references/swagger.json` di official skill repo
> (TrendingTokensResponseV2, TrendingCAsResponseV2, MentionV2, ChatResponseV2,
> ApiKeyCreateQueryRequestBody). camelCase di API; mapping ke snake_case DB
> kita lakukan di service layer.

```typescript
// Items returned by /v2/aggregations/trending-tokens (data.data[])
export interface TrendingTokenItem {
  token: string;
  currentCount: number;
  previousCount: number;
  changePercent: number;
}

// Items returned by /v2/aggregations/trending-cas/{platform} (data.data[])
export interface TrendingCAItem {
  contractAddress: string;
  chain: string;       // e.g. "ethereum", "solana"
  mentionCount: number;
}

// Items returned by /v2/data/top-mentions (data[])
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

// Top-mentions response: data[] + metadata.total
export interface TopMentionsResponse {
  data: MentionItem[];
  metadata: { pageSize: number; page: number; total: number };
}

// /v2/chat body & response
export interface ChatRequest {
  message: string;
  analysisType?: "chat" | "macro" | "summary" | "tokenIntro" | "tokenAnalysis" | "accountAnalysis";
  speed?: "fast" | "expert";
  sessionId?: string;
}

export interface ChatResponse {
  data: { message: string; sessionId: string; creditsConsumed: number };
}

// Auto request body (validate / create) — top-level title/description, EQL inside `query`
export interface EqlQuery {
  conditions: object;
  actions: { stepId: string; type: string; params: object }[];
  expiresIn: string;
}

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
```

### `src/elfa/client.ts`

> Note: `/v2/aggregations/trending-tokens` dan `trending-cas/*` membungkus payload
> di `data.data` (nested). Top-mentions di `data[]` flat. Param top-mentions adalah
> **`ticker`**, bukan `symbol`. Chat body field adalah **`message`** + `analysisType`.

```typescript
import ky from "ky";
import { config } from "../config";
import { getElfaTrendCache, setElfaTrendCache } from "../db";
import type {
  TrendingTokenItem,
  TrendingCAItem,
  MentionItem,
  TopMentionsResponse,
  ChatResponse,
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
  if (hit && Date.now() - Number(hit.fetched_at) < CACHE_TTL_MS) return hit.data as T;
  const data = await fetcher();
  await setElfaTrendCache(key, data);
  return data;
}

interface TrendingTokensResponse {
  success: boolean;
  data: { pageSize: number; page: number; total: number; data: TrendingTokenItem[] };
}
interface TrendingCAsResponse {
  success: boolean;
  data: { pageSize: number; page: number; total: number; data: TrendingCAItem[] };
}

export async function getTrendingTokens(
  timeWindow = "1h",
  pageSize = 50,
): Promise<TrendingTokenItem[]> {
  return cached(`trending-tokens:${timeWindow}:${pageSize}`, async () => {
    const res = await elfa.get("/v2/aggregations/trending-tokens", {
      searchParams: { timeWindow, pageSize },
    }).json<TrendingTokensResponse>();
    return res.data?.data ?? [];
  });
}

export async function getTrendingCAsTwitter(timeWindow = "1h") {
  return cached(`trending-cas:twitter:${timeWindow}`, async () => {
    const res = await elfa.get("/v2/aggregations/trending-cas/twitter", {
      searchParams: { timeWindow },
    }).json<TrendingCAsResponse>();
    return res.data?.data ?? [];
  });
}

export async function getTrendingCAsTelegram(timeWindow = "1h") {
  return cached(`trending-cas:telegram:${timeWindow}`, async () => {
    const res = await elfa.get("/v2/aggregations/trending-cas/telegram", {
      searchParams: { timeWindow },
    }).json<TrendingCAsResponse>();
    return res.data?.data ?? [];
  });
}

export async function getTopMentions(
  ticker: string,
  timeWindow = "1h",
): Promise<TopMentionsResponse> {
  return cached(`top-mentions:${ticker}:${timeWindow}`, async () => {
    const res = await elfa.get("/v2/data/top-mentions", {
      searchParams: { ticker, timeWindow },
    }).json<{ success: boolean; data: MentionItem[]; metadata: TopMentionsResponse["metadata"] }>();
    return { data: res.data ?? [], metadata: res.metadata };
  });
}

export async function elfaChat(
  message: string,
  speed: "fast" | "expert" = "fast",
  sessionId?: string,
) {
  const body: Record<string, unknown> = { message, analysisType: "chat", speed };
  if (sessionId) body.sessionId = sessionId;
  const res = await elfa.post("/v2/chat", { json: body }).json<ChatResponse>();
  return { message: res.data.message, sessionId: res.data.sessionId };
}

// API tidak expose mindshare_pct langsung — kita derive dari currentCount share.
export function tokenMindshareBps(token: TrendingTokenItem, batch: TrendingTokenItem[]): number {
  const total = batch.reduce((s, t) => s + (t.currentCount ?? 0), 0);
  if (total === 0) return 0;
  return Math.min(10_000, Math.round(((token.currentCount ?? 0) / total) * 10_000));
}

export function topMentionsToBps(total: number, scale = 10): number {
  return Math.min(100_000, total * scale);
}
```

**Trend-discovery endpoints + identifier helpers** — dipakai khusus untuk
trend markets (asset_class 6):

```typescript
// GET /v2/data/trending-narratives → trending narrative clusters
//   Discovery primitive utama untuk auto-spawn trend markets
//   Returns: { metadata, narratives: [{ narrative, tweet_ids, source_links }] }
export async function getTrendingNarratives(
  timeFrame: "day" | "week" = "day",
  maxNarratives = 10,
): Promise<TrendingNarrativesResponse>;

// GET /v2/data/keyword-mentions?keywords=X&timeWindow=1h
//   Volume signal untuk trend market mindshare derivation
//   Accepts up to 5 comma-separated keywords
//   Returns: { data: MentionItem[], metadata: { total } }
export async function getKeywordMentions(
  keywords: string | string[],
  timeWindow = "1h",
): Promise<KeywordMentionsResponse>;

// Identifier helpers untuk trend convention `trend:<slug>`
export function normalizeTrendId(phrase: string): string | null;
//   "Chinese Baddies"        → "trend:chinese-baddies"
//   "AI agents replacing..." → null  (>32 bytes after slug)

export function trendIdToKeyword(identifier: string): string | null;
//   "trend:chinese-baddies"  → "chinese baddies" (untuk pass ke Elfa keyword-mentions)

export function isTrendId(identifier: string): boolean;
```

### `src/elfa/auto-client.ts`

**Outgoing request signing (mutation endpoints only)** — per official Elfa skill:

```
payload   = `${timestamp}${METHOD}${mountedPath}${body}`
signature = HMAC-SHA256(payload, ELFA_API_SECRET) → hex (no prefix)
headers   = x-elfa-api-key, x-elfa-timestamp, x-elfa-signature
```

`mountedPath` = path **setelah** `/v2/auto`. HMAC **wajib** untuk:
- `POST /v2/auto/queries` (create)
- `DELETE /v2/auto/queries/{queryId}` (cancel — bukan POST `/cancel`!)
- `POST /v2/auto/chat` (builder chat)
- `POST /v2/auto/queries/drafts/{draftId}/convert`
- `POST /v2/auto/exchanges` (connect)
- `DELETE /v2/auto/exchanges/{exchange}` (disconnect)

HMAC **tidak diperlukan** untuk:
- `POST /v2/auto/queries/validate`
- `POST /v2/auto/queries/preview`
- `POST /v2/auto/queries/drafts` + draft GET/DELETE/preview
- `GET /v2/auto/validate-symbol/{symbol}` (free)

**Request body** (per swagger `ApiKeyCreateQueryRequestBody`): `{ title?, description?, query: { conditions, actions, expiresIn } }` — `title` dan `description` di top-level, EQL di-wrap dalam `query`. Kedua-nya muncul di Telegram/webhook delivery, jadi selalu set keduanya.

```typescript
import ky from "ky";
import { createHmac } from "crypto";
import { config } from "../config";
import type {
  AutoQueryRequest,
  AutoCreateQueryResponse,
  AutoValidateResult,
} from "./types";

function sign(method: "GET" | "POST" | "DELETE", mountedPath: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}${method}${mountedPath}${body}`;
  const signature = createHmac("sha256", config.ELFA_API_SECRET)
    .update(payload).digest("hex");
  return { signature, timestamp };
}

const auto = ky.create({
  baseUrl: config.ELFA_API_BASE,
  headers: { "x-elfa-api-key": config.ELFA_API_KEY },
  timeout: 30_000,
});

const authHeaders = (s: { signature: string; timestamp: string }) => ({
  "x-elfa-signature": s.signature,
  "x-elfa-timestamp": s.timestamp,
});

// No-HMAC: validate
export async function validateQuery(req: AutoQueryRequest) {
  return auto.post("/v2/auto/queries/validate", { json: req })
    .json<AutoValidateResult>();
}

// HMAC: create
export async function createQuery(req: AutoQueryRequest) {
  const body = JSON.stringify(req);
  const s = sign("POST", "/queries", body);
  return auto.post("/v2/auto/queries", {
    body, headers: { ...authHeaders(s), "Content-Type": "application/json" },
  }).json<AutoCreateQueryResponse>();
}

// HMAC: cancel — DELETE /v2/auto/queries/{queryId}, body=""
export async function cancelQuery(queryId: string) {
  const s = sign("DELETE", `/queries/${queryId}`, "");
  await auto.delete(`/v2/auto/queries/${queryId}`, { headers: authHeaders(s) });
}

// No-HMAC: validate-symbol (GET)
export async function validateSymbol(symbol: string): Promise<{ supported: boolean }> {
  try {
    return await auto.get(`/v2/auto/validate-symbol/${encodeURIComponent(symbol)}`)
      .json<{ supported: boolean }>();
  } catch {
    return { supported: false };
  }
}
```

---

## 9. Services

### `src/services/trending-poller.ts`

Cron tiap 15 menit. Fetch 4 endpoint Elfa, simpan ke DB, trigger auto-spawn:

- `pollNarratives()` — fetch `trending-narratives` → spawn `trend:<slug>` markets (class 6)
- `pollTokens()` — fetch `trending-tokens` → spawn ticker markets (class 0/1)
- `pollCAs("twitter" | "telegram")` — fetch `trending-cas` → spawn CA markets (class 5)

Identifier convention: backend slugify narrative phrase ke `trend:<slug>` lewat
`elfa.normalizeTrendId()`. Phrase yang gagal slug (>32 bytes) di-skip — itu OK,
narrative cluster lain biasanya muncul lagi di poll berikutnya.

```typescript
import cron from "node-cron";
import * as elfa from "../elfa/client";
import * as db from "../db";
import { config } from "../config";
import { log } from "../utils/log";
import { marketSpawner } from "./market-spawner";
import { metadataEnricher } from "./metadata-enricher";

function detectAssetClass(symbol: string): number {
  if (symbol.startsWith("xyz:")) {
    const base = symbol.slice(4);
    if (/^[A-Z]{6}$/.test(base)) return 4;             // FX (e.g. EURUSD)
    if (["XAU","XAG","CL","NG","HG","ZW","ZC"].includes(base)) return 3; // commodity
    return 2;                                          // equity
  }
  return 0;                                            // crypto
}

export class TrendingPoller {
  start() {
    this.pollAll().catch((e) => log.error({ err: e }, "Initial poll failed"));
    cron.schedule("*/15 * * * *", () => {
      this.pollAll().catch((e) => log.error({ err: e }, "Scheduled poll failed"));
    });
    log.info("TrendingPoller started (every 15 min)");
  }

  async pollAll() {
    await Promise.allSettled([
      this.pollTokens(),
      this.pollCAs("twitter"),
      this.pollCAs("telegram"),
    ]);
  }

  async pollTokens() {
    const tokens = await elfa.getTrendingTokens("1h", 50);
    for (const [idx, token] of tokens.entries()) {
      const mindshareBps = elfa.tokenMindshareBps(token, tokens);
      const mindsharePct = mindshareBps / 100;

      await db.upsertTrendingToken({
        symbol: token.token,
        mention_count: token.currentCount,
        mindshare_pct: mindsharePct,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      if (mindsharePct > config.AUTO_SPAWN_THRESHOLD_PCT) {
        const existing = await db.getMarketByIdentifier(token.token);
        if (!existing) {
          marketSpawner.ensureMarket({
            identifier: token.token,
            assetClass: detectAssetClass(token.token),
            source: "auto_spawn",
          }).catch((e) => log.warn({ err: e, symbol: token.token }, "Auto-spawn failed"));
        }
      }
    }
    log.info({ count: tokens.length }, "Trending tokens polled");
  }

  async pollCAs(platform: "twitter" | "telegram") {
    const cas = platform === "twitter"
      ? await elfa.getTrendingCAsTwitter("1h")
      : await elfa.getTrendingCAsTelegram("1h");

    for (const [idx, ca] of cas.entries()) {
      const isSolana = ca.chain === "solana";

      await db.upsertTrendingCA({
        contract_address: ca.contractAddress,
        source_platform: platform,
        mention_count: ca.mentionCount,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      // Hanya spawn market untuk CA di chain Solana (program kita Solana)
      if (isSolana) metadataEnricher.fetch(ca.contractAddress).catch(() => {});

      if (isSolana && ca.mentionCount > config.CA_SPAWN_THRESHOLD) {
        const existing = await db.getMarketByIdentifier(ca.contractAddress);
        if (!existing) {
          const meta = await db.getTokenMetadata(ca.contractAddress);
          marketSpawner.ensureMarket({
            identifier: ca.contractAddress,
            assetClass: 5,
            source: "auto_spawn",
            displayName: meta?.symbol ?? meta?.name ?? null,
            imageUrl: meta?.image_url ?? null,
          }).catch((e) => log.warn({ err: e, ca: ca.contractAddress }, "CA spawn failed"));
        }
      }
    }
    log.info({ platform, count: cas.length }, "Trending CAs polled");
  }
}

export const trendingPoller = new TrendingPoller();
```

### `src/services/market-spawner.ts`

```typescript
import { Keypair } from "@solana/web3.js";
import { buildCreateMarketTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { marketPda } from "../solana/pda";
import * as db from "../db";
import * as autoManager from "./auto-manager";
import { log } from "../utils/log";

const DEFAULT_BASE_VIRTUAL_SOL = 30_000_000_000n;       // 30 SOL
const DEFAULT_VIRTUAL_TOKEN_SUPPLY = 1_000_000_000_000_000n; // 1B × 10^6
const DEFAULT_ELASTICITY_BPS = 5000;

export class MarketSpawner {
  private pending = new Set<string>();

  async ensureMarket(params: {
    identifier: string;
    assetClass: number;
    source: "auto_spawn" | "user_search" | "user_link_paste";
    displayName?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    sourceMetadata?: object | null;
  }): Promise<db.MarketRow> {
    const { identifier } = params;

    const existing = await db.getMarketByIdentifier(identifier);
    if (existing) return existing;

    if (this.pending.has(identifier)) {
      await new Promise((r) => setTimeout(r, 3000));
      const after = await db.getMarketByIdentifier(identifier);
      return after ?? this.ensureMarket(params);
    }

    this.pending.add(identifier);
    try {
      return await this.spawn(params);
    } finally {
      this.pending.delete(identifier);
    }
  }

  private async spawn(params: Parameters<MarketSpawner["ensureMarket"]>[0]): Promise<db.MarketRow> {
    const { identifier, assetClass, source } = params;
    log.info({ identifier, assetClass, source }, "Spawning market");

    const mintKeypair = Keypair.generate();

    const tx = await buildCreateMarketTx({
      identifier,
      assetClass,
      mintKeypairPubkey: mintKeypair.publicKey,
      oracleAuthority: signer.publicKey,    // backend authoritative oracle
      baseVirtualSol: DEFAULT_BASE_VIRTUAL_SOL,
      virtualTokenSupply: DEFAULT_VIRTUAL_TOKEN_SUPPLY,
      elasticityBps: DEFAULT_ELASTICITY_BPS,
    });

    const sig = await sendAndConfirm(tx, [mintKeypair]);
    log.info({ identifier, sig }, "Market spawned on-chain");

    const [market] = marketPda(identifier);

    await db.upsertMarket({
      pda: market.toBase58(),
      mint: mintKeypair.publicKey.toBase58(),
      identifier,
      asset_class: assetClass,
      display_name: params.displayName ?? null,
      image_url: params.imageUrl ?? null,
      source_url: params.sourceUrl ?? null,
      source_metadata: params.sourceMetadata ?? null,
      base_virtual_sol: DEFAULT_BASE_VIRTUAL_SOL,
      virtual_token_supply: DEFAULT_VIRTUAL_TOKEN_SUPPLY,
      creator_pubkey: signer.publicKey.toBase58(),
      creator_source: source,
      created_at: BigInt(Date.now()),
    });

    const row = (await db.getMarketByIdentifier(identifier))!;

    // Provision Elfa Auto hype watcher (best effort)
    autoManager.createHypeWatcher(row).catch((e) =>
      log.warn({ err: e, identifier }, "Auto hype watcher failed"),
    );

    return row;
  }
}

export const marketSpawner = new MarketSpawner();
```

### `src/services/oracle-updater.ts`

> **Catatan arsitektur:** ratchet sekarang **display-only**. Program pakai pure
> constant-product AMM (`pool_sol = base_virtual_sol + real_sol_reserves`). Oracle
> updater tetap jalan supaya UI mindshare progress bar + ratchet meter ter-update.
> On-chain `update_mindshare` punya `min_update_interval_secs = 300` (5 menit) yang
> di-enforce on-chain — kita pakai 5+ menit guard di sisi backend juga.

```typescript
import cron from "node-cron";
import * as db from "../db";
import * as elfa from "../elfa/client";
import { buildUpdateMindshareTx, sendAndConfirm } from "../solana/instructions";
import { log } from "../utils/log";

const MIN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const MINDSHARE_BPS_MAX = 100_000;

export class OracleUpdater {
  start() {
    cron.schedule("*/15 * * * *", () => {
      this.updateAll().catch((e) => log.error({ err: e }, "Oracle update all failed"));
    });
    log.info("OracleUpdater started (every 15 min)");
  }

  async updateAll() {
    const markets = await db.getAllActiveMarkets();
    for (const m of markets) {
      try { await this.updateOne(m); }
      catch (e) { log.warn({ err: e, pda: m.pda }, "updateOne failed"); }
    }
  }

  async updateOne(market: db.MarketRow) {
    const last = await db.getLastMindshareEntry(market.pda);
    if (last && Date.now() - Number(last.recorded_at) < MIN_UPDATE_INTERVAL_MS) return;

    const bps = await this.fetchMindshareBps(market);
    if (bps === 0) return;

    await this.submit(market.pda, market.identifier, bps);
  }

  async submit(marketPda: string, identifier: string, bps: number) {
    const tx = await buildUpdateMindshareTx({ identifier, newMindshareBps: bps });
    const sig = await sendAndConfirm(tx);

    await db.appendMindshareHistory({
      market_pda: marketPda,
      current_bps: bps,
      source: "rest_poll",
      tx_signature: sig,
      recorded_at: BigInt(Date.now()),
    });

    // Update mirror; on-chain peak/ratchet kita kalkulasi untuk display.
    // For exact correctness, trade-indexer akan re-sync dari oracle account periodically.
    const mkt = (await db.getMarketByPda(marketPda))!;
    const peak = Math.max(mkt.peak_mindshare_bps, bps);
    const ratchet = Math.min(50_000, 10_000 + Math.floor((peak * 5000) / 10_000)); // elasticity 5000
    await db.updateMarketMindshare(marketPda, bps, peak, ratchet);

    log.info({ identifier, bps, sig }, "Oracle updated");
  }

  /**
   * Mindshare derivation per asset class:
   *   crypto/dex (0,1) → cached relative share dari trending-tokens batch (poller)
   *   equity/commodity/fx (2,3,4) → top-mentions metadata.total × scale
   *   CA (5) → trending_cas.mention_count × scale (placeholder)
   */
  async fetchMindshareBps(market: db.MarketRow): Promise<number> {
    if (market.asset_class < 2) {
      const cached = await db.getLatestTrendingToken(market.identifier);
      if (cached && Date.now() - Number(cached.fetched_at) < 20 * 60 * 1000) {
        return Math.min(MINDSHARE_BPS_MAX, Math.round((cached.mindshare_pct ?? 0) * 100));
      }
      try {
        const res = await elfa.getTopMentions(market.identifier, "1h");
        return elfa.topMentionsToBps(res.metadata?.total ?? 0, 10);
      } catch { return 0; }
    }

    if (market.asset_class >= 2 && market.asset_class <= 4) {
      try {
        const res = await elfa.getTopMentions(market.identifier, "1h");
        return elfa.topMentionsToBps(res.metadata?.total ?? 0, 5);
      } catch { return 0; }
    }

    return 0;
  }
}

export const oracleUpdater = new OracleUpdater();
```

### `src/services/metadata-enricher.ts`

```typescript
import * as db from "../db";
import { config } from "../config";
import { log } from "../utils/log";

export class MetadataEnricher {
  async fetch(addr: string): Promise<db.TokenMetadataRow | null> {
    const cached = await db.getTokenMetadata(addr);
    if (cached && Date.now() - Number(cached.fetched_at) < 24 * 60 * 60 * 1000) return cached;

    // 1. Helius DAS (getAsset)
    try {
      const res = await fetch(config.SOLANA_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getAsset", params: { id: addr } }),
      });
      const data: any = await res.json();
      if (data.result) {
        const meta: db.TokenMetadataRow = {
          contract_address: addr,
          symbol: data.result.content?.metadata?.symbol ?? null,
          name: data.result.content?.metadata?.name ?? null,
          image_url: data.result.content?.links?.image ?? null,
          decimals: data.result.token_info?.decimals ?? null,
          total_supply: null,
          source: "helius_das",
          fetched_at: BigInt(Date.now()),
        };
        await db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) { log.debug({ err: e, addr }, "Helius DAS failed"); }

    // 2. Jupiter strict list
    try {
      const res = await fetch("https://token.jup.ag/strict", { signal: AbortSignal.timeout(10_000) });
      const list: any[] = await res.json();
      const found = list.find((t) => t.address === addr);
      if (found) {
        const meta: db.TokenMetadataRow = {
          contract_address: addr,
          symbol: found.symbol, name: found.name,
          image_url: found.logoURI, decimals: found.decimals,
          total_supply: null, source: "jupiter",
          fetched_at: BigInt(Date.now()),
        };
        await db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) { log.debug({ err: e, addr }, "Jupiter fallback failed"); }

    return null;
  }
}

export const metadataEnricher = new MetadataEnricher();
```

### `src/services/auto-manager.ts`

```typescript
import cron from "node-cron";
import * as db from "../db";
import * as autoClient from "../elfa/auto-client";
import { config } from "../config";
import { log } from "../utils/log";

export async function createHypeWatcher(market: db.MarketRow): Promise<string | null> {
  // Skip CA dengan identifier panjang (Auto symbol pakai length cap)
  if (market.asset_class === 5 && market.identifier.length > 20) {
    log.debug({ identifier: market.identifier }, "Skipping Auto query for long CA");
    return null;
  }

  // Request body shape: { title, description, query: { conditions, actions, expiresIn } }
  // Title + description di top-level (muncul di Telegram/webhook delivery).
  const request = {
    title: `Tredie hype: ${market.identifier}`,
    description:
      `Watcher for ${market.identifier} on Tredie. Triggers boost peak mindshare ` +
      `on-chain when the market shows a momentum or social-attention surge.`,
    query: {
      conditions: {
        OR: [
          {
            AND: [
              { source: "ta", method: "rsi",
                args: { symbol: market.identifier, timeframe: "1h", period: 14 },
                operator: "crosses_above", value: 70 },
              { source: "price", method: "change",
                args: { symbol: market.identifier, period: "1h" },
                operator: ">", value: 0.05 },
            ],
          },
          { source: "llm", method: "athena_condition",
            args: {
              query: `Has ${market.identifier} had a viral mention or smart-account buy call in the last 1h?`,
              period: "1h", speed: "fast",
            },
            operator: "==", value: true },
        ],
      },
      actions: [
        { stepId: "step_1", type: "webhook",
          params: { url: `${config.BACKEND_URL}/api/webhooks/elfa?market=${market.pda}&type=hype_event` } },
      ],
      expiresIn: "7d",
    },
  };

  try {
    const v = await autoClient.validateQuery(request);
    if (!v.valid) {
      log.warn({ errors: v.errors, identifier: market.identifier }, "Auto query invalid");
      return null;
    }
    const created = await autoClient.createQuery(request);
    await db.insertAutoQuery({
      query_id: created.queryId,
      query_type: "hype_event",
      market_pda: market.pda,
      config: request,
      status: "active",
      created_at: BigInt(Date.now()),
      expires_at: BigInt(Date.now() + 7 * 86_400_000),
    });
    log.info({ queryId: created.queryId, identifier: market.identifier }, "Auto watcher created");
    return created.queryId;
  } catch (e) {
    log.warn({ err: e, identifier: market.identifier }, "Auto watcher failed");
    return null;
  }
}

export function startRotationCron() {
  cron.schedule("0 2 * * *", async () => {
    const expiring = await db.getAutoQueriesExpiringSoon(24 * 60 * 60 * 1000);
    for (const q of expiring) {
      try {
        await autoClient.cancelQuery(q.query_id);
        if (q.market_pda) {
          const market = await db.getMarketByPda(q.market_pda);
          if (market) await createHypeWatcher(market);
        }
      } catch (e) { log.warn({ err: e, queryId: q.query_id }, "Rotation failed"); }
    }
  });
}
```

### `src/services/link-resolver.ts`

```typescript
import { log } from "../utils/log";
import * as db from "../db";

export interface LinkMetadata {
  platform: "twitter" | "tiktok" | "youtube" | "instagram" | "unknown";
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  authorName?: string;
  embedHtml?: string;
}

export class LinkResolver {
  async resolve(url: string): Promise<LinkMetadata> {
    const cached = await db.getLinkCache(url);
    if (cached && Number(cached.expires_at) > Date.now()) {
      return cached.metadata as LinkMetadata;
    }

    const platform = this.detectPlatform(url);
    let metadata: LinkMetadata = { platform: "unknown" };

    try {
      switch (platform) {
        case "twitter":   metadata = await this.resolveTwitter(url); break;
        case "tiktok":    metadata = await this.resolveTikTok(url); break;
        case "youtube":   metadata = await this.resolveYouTube(url); break;
        case "instagram": metadata = await this.resolveOg(url, "instagram"); break;
      }
    } catch (e) {
      log.warn({ err: e, url }, "Link resolution failed");
    }

    await db.cacheLinkResolution(url, platform, metadata);
    return metadata;
  }

  private detectPlatform(url: string): LinkMetadata["platform"] {
    if (/twitter\.com|x\.com/i.test(url)) return "twitter";
    if (/tiktok\.com/i.test(url)) return "tiktok";
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    if (/instagram\.com/i.test(url)) return "instagram";
    return "unknown";
  }

  private async resolveTikTok(url: string): Promise<LinkMetadata> {
    const d: any = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`).then((r) => r.json());
    return { platform: "tiktok", title: d.title, thumbnailUrl: d.thumbnail_url, authorName: d.author_name, embedHtml: d.html };
  }

  private async resolveYouTube(url: string): Promise<LinkMetadata> {
    const d: any = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`).then((r) => r.json());
    return { platform: "youtube", title: d.title, thumbnailUrl: d.thumbnail_url, authorName: d.author_name, embedHtml: d.html };
  }

  private async resolveTwitter(url: string): Promise<LinkMetadata> {
    try {
      const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`);
      if (!res.ok) throw new Error("oembed failed");
      const d: any = await res.json();
      return { platform: "twitter", authorName: d.author_name, embedHtml: d.html };
    } catch {
      return this.resolveOg(url, "twitter");
    }
  }

  private async resolveOg(url: string, platform: LinkMetadata["platform"]): Promise<LinkMetadata> {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Twitterbot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    return {
      platform,
      title: extractMeta(html, "og:title"),
      description: extractMeta(html, "og:description"),
      thumbnailUrl: extractMeta(html, "og:image"),
    };
  }
}

function extractMeta(html: string, prop: string): string | undefined {
  const m =
    html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, "i"));
  return m?.[1];
}

export const linkResolver = new LinkResolver();
```

### `src/services/symbol-extractor.ts`

```typescript
import * as elfaClient from "../elfa/client";
import * as autoClient from "../elfa/auto-client";
import { metadataEnricher } from "./metadata-enricher";
import type { LinkMetadata } from "./link-resolver";
import { log } from "../utils/log";

export interface ExtractionResult {
  symbol: string | null;
  confidence: "high" | "medium" | "low";
}

export class SymbolExtractor {
  async extract(meta: LinkMetadata): Promise<ExtractionResult> {
    const text = `${meta.title ?? ""} ${meta.description ?? ""} ${meta.authorName ?? ""}`.slice(0, 2000);

    // A. Cashtag
    const cashtag = text.match(/\$([A-Z]{2,10})\b/);
    if (cashtag) {
      const v = await autoClient.validateSymbol(cashtag[1]);
      if (v.supported) return { symbol: cashtag[1], confidence: "high" };
    }

    // B. Solana CA
    const ca = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
    if (ca) {
      const m = await metadataEnricher.fetch(ca[1]);
      if (m) return { symbol: ca[1], confidence: "high" };
    }

    // C. xyz: prefix probe
    const upperWords = text.match(/\b([A-Z]{2,6})\b/g) ?? [];
    for (const w of upperWords.slice(0, 15)) {
      const v = await autoClient.validateSymbol(`xyz:${w}`);
      if (v.supported) return { symbol: `xyz:${w}`, confidence: "medium" };
    }

    // D. Elfa Chat fallback
    try {
      const r = await elfaClient.elfaChat(
        `What single financial asset (crypto/equity/commodity) is this content primarily about? ` +
        `Return ONLY the ticker symbol. Use xyz: prefix for equities/commodities. Return "none" if unclear. ` +
        `Content: ${text.slice(0, 500)}`, "fast",
      );
      const x = r.answer.trim().replace(/[^a-zA-Z0-9:]/g, "");
      if (x && x !== "none") {
        const v = await autoClient.validateSymbol(x);
        if (v.supported) return { symbol: x, confidence: "medium" };
      }
    } catch (e) { log.debug({ err: e }, "Elfa Chat extraction failed"); }

    return { symbol: null, confidence: "low" };
  }
}

export const symbolExtractor = new SymbolExtractor();
```

### `src/services/trade-indexer.ts`

Dipanggil oleh Helius webhook. Parse `Trade` event log, simpan ke `trades`, sync market
state. Insert ke `trades` otomatis memicu Realtime ke frontend.

```typescript
import { parseTradeEvents } from "../solana/decoder";
import * as db from "../db";
import { log } from "../utils/log";

export async function indexTransaction(tx: {
  signature: string;
  slot: number;
  blockTime?: number;
  meta?: { logMessages?: string[] };
}) {
  const logs = tx.meta?.logMessages ?? [];
  const events = parseTradeEvents(logs);
  if (events.length === 0) return;

  for (const ev of events) {
    const market = await db.getMarketByPda(ev.market);
    if (!market) {
      log.debug({ market: ev.market }, "Trade for unknown market — skipping");
      continue;
    }

    await db.insertTrade({
      signature: tx.signature,
      market_pda: ev.market,
      side: ev.side,
      trader: ev.trader,
      sol_amount: ev.solAmount,
      token_amount: ev.tokenAmount,
      ratchet_bps: ev.ratchetBps,
      block_time: BigInt(tx.blockTime ?? Number(ev.timestamp)),
      slot: BigInt(tx.slot),
    });

    // Sync market state berdasarkan delta event
    const newReserves = ev.side === 0
      ? market.real_sol_reserves + ev.solAmount
      : market.real_sol_reserves - ev.solAmount;
    const newMinted = ev.side === 0
      ? market.tokens_minted + ev.tokenAmount
      : market.tokens_minted - ev.tokenAmount;

    await db.syncMarketStateFromTrade({
      pda: ev.market,
      real_sol_reserves: newReserves > 0n ? newReserves : 0n,
      tokens_minted: newMinted > 0n ? newMinted : 0n,
      slot: BigInt(tx.slot),
    });

    log.info(
      { signature: tx.signature, market: ev.market, side: ev.side },
      "Trade indexed",
    );
  }
}
```

---

## 10. API Routes (Hono)

### `src/api/routes.ts`

```typescript
import { Hono } from "hono";
import { healthRoutes } from "./health";
import { marketsRoutes } from "./markets";
import { trendingRoutes } from "./trending";
import { searchRoutes } from "./search";
import { resolveLinkRoutes } from "./resolve-link";
import { webhookRoutes } from "./webhooks";

export function buildRouter() {
  const app = new Hono();
  const v1 = new Hono();

  v1.route("/health", healthRoutes);
  v1.route("/markets", marketsRoutes);
  v1.route("/trending", trendingRoutes);
  v1.route("/search", searchRoutes);
  v1.route("/resolve-link", resolveLinkRoutes);

  app.route("/api/v1", v1);
  app.route("/api/webhooks", webhookRoutes);

  return app;
}
```

### `src/api/health.ts`

```typescript
import { Hono } from "hono";
import { connection } from "../solana/connection";
import { sql } from "../db";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  let slot = 0;
  try { slot = await connection.getSlot(); } catch {}

  const [last] = await sql<{ block_time: bigint | null }[]>`
    SELECT block_time FROM trades ORDER BY block_time DESC LIMIT 1
  `;

  return c.json({
    ok: true,
    version: "1.0.0",
    stack: "hono+supabase",
    slot,
    lastIndexedTrade: last?.block_time?.toString() ?? null,
  });
});
```

### `src/api/markets.ts`

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import * as db from "../db";
import { sql } from "../db";
import { buildBuyTx, buildSellTx } from "../solana/instructions";
import { marketSpawner } from "../services/market-spawner";

export const marketsRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

marketsRoutes.get("/", async (c) => {
  const assetClass = c.req.query("assetClass");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const sortBy = c.req.query("sortBy") ?? "mindshare";
  const order = c.req.query("order") === "asc" ? "ASC" : "DESC";
  const sortCol = sortBy === "volume" ? sql`real_sol_reserves` : sql`current_mindshare_bps`;

  const rows = assetClass !== undefined && assetClass !== ""
    ? await sql`SELECT * FROM markets WHERE asset_class = ${Number(assetClass)}
                ORDER BY ${sortCol} ${order === "ASC" ? sql`ASC` : sql`DESC`} LIMIT ${limit}`
    : await sql`SELECT * FROM markets
                ORDER BY ${sortCol} ${order === "ASC" ? sql`ASC` : sql`DESC`} LIMIT ${limit}`;

  const [{ count }] = await sql<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM markets`;

  return c.json(jsonSafe({ markets: rows, total: count }));
});

marketsRoutes.get("/:identifier", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);

  const [history, trades] = await Promise.all([
    db.getMindshareHistory(market.pda, 200),
    db.getRecentTrades(market.pda, 50),
  ]);

  return c.json(jsonSafe({ market, mindshareHistory: history, recentTrades: trades }));
});

marketsRoutes.get("/:identifier/trades", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);
  const trades = await db.getRecentTrades(market.pda, limit);
  return c.json(jsonSafe({ trades }));
});

const prepareTradeSchema = z.object({
  identifier: z.string(),
  side: z.enum(["buy", "sell"]),
  solAmount: z.number().optional(),
  tokenAmount: z.string().optional(),    // bigint as string
  slippageBps: z.number().int().nonnegative().default(100),
  trader: z.string(),
});

marketsRoutes.post("/prepare-trade", async (c) => {
  const body = prepareTradeSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { identifier, side, solAmount, tokenAmount, trader } = body.data;

  const market = await db.getMarketByIdentifier(identifier);
  if (!market) return c.json({ error: "Market not found" }, 404);

  const traderPk = new PublicKey(trader);
  const mintPk = new PublicKey(market.mint);

  let tx;
  if (side === "buy") {
    if (solAmount === undefined) return c.json({ error: "solAmount required for buy" }, 400);
    const solIn = BigInt(Math.floor(solAmount * 1e9));
    tx = await buildBuyTx({
      buyer: traderPk, identifier, mintPubkey: mintPk,
      solAmountIn: solIn, minTokensOut: 0n, // TODO: kalkulasi dari slippage
    });
  } else {
    if (!tokenAmount) return c.json({ error: "tokenAmount required for sell" }, 400);
    tx = await buildSellTx({
      seller: traderPk, identifier, mintPubkey: mintPk,
      tokensIn: BigInt(tokenAmount), minSolOut: 0n,
    });
  }

  return c.json({
    transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
  });
});

const prepareCreateSchema = z.object({
  identifier: z.string().min(1).max(32),
  source: z.enum(["user_search", "user_link_paste", "auto_spawn"]).default("user_search"),
  assetClass: z.number().int().min(0).max(5).default(0),
  sourceMetadata: z.record(z.unknown()).optional(),
});

marketsRoutes.post("/prepare-create", async (c) => {
  const body = prepareCreateSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const existing = await db.getMarketByIdentifier(body.data.identifier);
  if (existing) return c.json(jsonSafe({ market: existing, alreadyExists: true }));

  try {
    const market = await marketSpawner.ensureMarket({
      identifier: body.data.identifier,
      assetClass: body.data.assetClass,
      source: body.data.source,
      sourceMetadata: body.data.sourceMetadata ?? null,
    });
    return c.json(jsonSafe({ market, alreadyExists: false }));
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
```

### `src/api/trending.ts`

```typescript
import { Hono } from "hono";
import { sql } from "../db";

export const trendingRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

trendingRoutes.get("/tokens", async (c) => {
  const threshold = BigInt(Date.now() - 20 * 60 * 1000);
  const rows = await sql`
    SELECT DISTINCT ON (tt.symbol)
      tt.*, m.pda AS market_pda, m.ratchet_multiplier_bps, m.real_sol_reserves
    FROM trending_tokens tt
    LEFT JOIN markets m ON m.identifier = tt.symbol
    WHERE tt.fetched_at > ${threshold}
    ORDER BY tt.symbol, tt.fetched_at DESC
  `;
  // Sort ulang berdasarkan rank_position
  const sorted = [...rows].sort((a: any, b: any) =>
    (a.rank_position ?? 999) - (b.rank_position ?? 999)
  ).slice(0, 50);
  return c.json(jsonSafe({ tokens: sorted }));
});

trendingRoutes.get("/cas/:platform", async (c) => {
  const platform = c.req.param("platform");
  if (!["twitter", "telegram"].includes(platform)) {
    return c.json({ error: "platform must be twitter or telegram" }, 400);
  }
  const threshold = BigInt(Date.now() - 20 * 60 * 1000);
  const rows = await sql`
    SELECT DISTINCT ON (tc.contract_address)
      tc.*, tm.symbol, tm.name, tm.image_url,
      m.pda AS market_pda, m.ratchet_multiplier_bps
    FROM trending_cas tc
    LEFT JOIN token_metadata tm ON tm.contract_address = tc.contract_address
    LEFT JOIN markets m ON m.identifier = tc.contract_address
    WHERE tc.source_platform = ${platform} AND tc.fetched_at > ${threshold}
    ORDER BY tc.contract_address, tc.fetched_at DESC
  `;
  const sorted = [...rows].sort((a: any, b: any) =>
    (a.rank_position ?? 999) - (b.rank_position ?? 999)
  ).slice(0, 50);
  return c.json(jsonSafe({ cas: sorted }));
});
```

### `src/api/search.ts`

```typescript
import { Hono } from "hono";
import { sql } from "../db";
import * as db from "../db";

export const searchRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

searchRoutes.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ suggestions: [] });

  const isCA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
  if (isCA) {
    const meta = await db.getTokenMetadata(q);
    const market = await db.getMarketByIdentifier(q);
    return c.json(jsonSafe({
      suggestions: [{
        type: "ca", value: q,
        display: `${meta?.symbol ?? "Unknown"} · ${q.slice(0, 6)}...${q.slice(-4)}`,
        marketPda: market?.pda,
      }],
    }));
  }

  const like = `%${q.toUpperCase()}%`;
  const markets = await sql<db.MarketRow[]>`
    SELECT * FROM markets
    WHERE UPPER(identifier) LIKE ${like} OR UPPER(display_name) LIKE ${like}
    LIMIT 8
  `;

  const suggestions = markets.map((m) => ({
    type: m.asset_class === 5 ? "ca" : "symbol",
    value: m.identifier,
    display: m.display_name ? `${m.identifier} · ${m.display_name}` : m.identifier,
    marketPda: m.pda,
    ratchetBps: m.ratchet_multiplier_bps,
  }));
  return c.json({ suggestions });
});
```

### `src/api/resolve-link.ts`

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { linkResolver } from "../services/link-resolver";
import { symbolExtractor } from "../services/symbol-extractor";
import * as db from "../db";

export const resolveLinkRoutes = new Hono();

const schema = z.object({ url: z.string().url() });

resolveLinkRoutes.post("/", async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const metadata = await linkResolver.resolve(body.data.url);
  const { symbol, confidence } = await symbolExtractor.extract(metadata);

  let suggestedMarketPath: string | null = null;
  if (symbol) {
    const market = await db.getMarketByIdentifier(symbol);
    suggestedMarketPath = market
      ? `/markets/${encodeURIComponent(symbol)}`
      : `/markets/${encodeURIComponent(symbol)}?create=true`;
    await db.cacheLinkResolution(body.data.url, metadata.platform, metadata, symbol);
  }

  return c.json({ metadata, extractedSymbol: symbol, confidence, suggestedMarketPath });
});
```

### `src/api/webhooks.ts`

Dua webhook: Elfa Auto (HMAC) dan Helius (Bearer token). Verifikasi pakai raw body
sebelum parse JSON — Hono `c.req.text()` aman untuk ini.

**Inbound Elfa webhook signing scheme** (per official Elfa skill, **berbeda dengan
outgoing request signing**):

```
signing_key = SHA256(ELFA_AUTO_WEBHOOK_SECRET)
expected    = HMAC-SHA256(`${ts}.${eventId}.${rawBody}`, signing_key) → hex
header      = X-Auto-Signature: v1=<hex>
              X-Auto-Signature-Timestamp: <unix_seconds>
              X-Auto-Event-Id: <unique_id>
replay cap  = 30 detik drift
```

Note perbedaan dari outgoing-request scheme:
- Secret di-**double-hash** (SHA256 dulu, baru jadi HMAC key)
- Payload pakai **dot separator** (`ts.eventId.body`)
- Signature header punya **`v1=` prefix**
- Header pakai prefix `X-Auto-*` (bukan `x-elfa-*` seperti outgoing)
- Replay window 30 detik, bukan 5 menit

```typescript
import { Hono } from "hono";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";
import * as db from "../db";
import { queue } from "../queue";
import { indexTransaction } from "../services/trade-indexer";
import { log } from "../utils/log";

export const webhookRoutes = new Hono();

function verifyAutoWebhook(
  rawBody: string,
  signatureHeader: string,
  timestamp: string,
  eventId: string,
): boolean {
  if (!signatureHeader.startsWith("v1=")) return false;
  const given = signatureHeader.slice(3);
  const signingKey = createHash("sha256")
    .update(config.ELFA_AUTO_WEBHOOK_SECRET).digest();
  const payload = `${timestamp}.${eventId}.${rawBody}`;
  const expected = createHmac("sha256", signingKey).update(payload).digest("hex");
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

webhookRoutes.post("/elfa", async (c) => {
  const sig = c.req.header("x-auto-signature");
  const ts = c.req.header("x-auto-signature-timestamp");
  const eventId = c.req.header("x-auto-event-id");
  if (!sig || !ts || !eventId)
    return c.json({ error: "Missing signature headers" }, 400);

  // Replay window: 30s drift cap (per Elfa docs)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 30) {
    return c.json({ error: "Timestamp drift too large" }, 401);
  }

  const rawBody = await c.req.text();
  if (!verifyAutoWebhook(rawBody, sig, ts, eventId)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  if (await db.autoEventExists(eventId)) {
    return c.json({ ok: true, duplicate: true });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return c.json({ error: "Invalid JSON" }, 400); }

  await db.insertAutoEvent({
    event_id: eventId,
    query_id: payload.queryId ?? "",
    channel: payload.channel ?? "webhook",
    payload,
    received_at: BigInt(Date.now()),
  });

  queue.push("auto_event", { eventId, payload });

  return c.json({ ok: true }, 202);
});

webhookRoutes.post("/helius", async (c) => {
  const auth = c.req.header("authorization");
  if (config.HELIUS_WEBHOOK_SECRET && auth !== `Bearer ${config.HELIUS_WEBHOOK_SECRET}`) {
    return c.text("Unauthorized", 401);
  }

  let txs: any[];
  try { txs = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON" }, 400); }

  for (const tx of txs) {
    try {
      await indexTransaction({
        signature: tx.signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        meta: { logMessages: tx.meta?.logMessages ?? tx.logMessages ?? [] },
      });
    } catch (e) {
      log.warn({ err: e, sig: tx.signature }, "Helius index failed");
    }
  }

  return c.text("OK");
});
```

---

## 11. Queue

In-memory FIFO untuk hype event processing. Setiap event ter-persist di `auto_events`
sebelum masuk queue, jadi restart aman — bisa replay dari DB.

### `src/queue/index.ts`

```typescript
import { log } from "../utils/log";
import * as db from "../db";
import { oracleUpdater } from "../services/oracle-updater";
import { config } from "../config";

type JobType = "auto_event";
interface Job { type: JobType; data: any; }

class InMemoryQueue {
  private jobs: Job[] = [];
  private processing = false;

  push(type: JobType, data: any) {
    this.jobs.push({ type, data });
    if (!this.processing) this.next();
  }

  private async next() {
    if (this.jobs.length === 0) { this.processing = false; return; }
    this.processing = true;
    const job = this.jobs.shift()!;
    try {
      await this.handle(job);
      if (job.type === "auto_event") {
        await db.markAutoEventProcessed(job.data.eventId, "success");
      }
    } catch (e) {
      log.error({ err: e, job }, "Queue job failed");
      if (job.type === "auto_event") {
        await db.markAutoEventProcessed(job.data.eventId, "failed");
      }
    }
    setTimeout(() => this.next(), 100);
  }

  private async handle(job: Job) {
    if (job.type !== "auto_event") return;
    const { payload } = job.data;
    const q = await db.getAutoQuery(payload.queryId);
    if (!q || q.query_type !== "hype_event" || !q.market_pda) return;

    const market = await db.getMarketByPda(q.market_pda);
    if (!market) return;

    const boosted = Math.min(market.peak_mindshare_bps + config.HYPE_EVENT_PREMIUM_BPS, 100_000);
    if (boosted > market.peak_mindshare_bps) {
      await oracleUpdater.submit(market.pda, market.identifier, boosted);
    }
    log.info({ identifier: market.identifier, boosted }, "Hype event processed");
  }
}

export const queue = new InMemoryQueue();
```

---

## 12. Phase Build Order

### Phase 1 — Server + DB (hari 1)

```
□ bun init, install deps (Hono, postgres, supabase-js, web3.js, ...)
□ tsconfig.json + package.json scripts
□ src/config.ts dengan zod validation
□ Bikin Supabase project, copy DATABASE_URL ke .env
□ src/db/migrations/001_initial.sql
□ src/db/migrate.ts + bun run db:migrate
□ src/db/index.ts dengan tagged-template helpers
□ src/index.ts — Hono server di port 4000
□ GET /api/v1/health → { ok: true }
```

**Acceptance**: `curl localhost:4000/api/v1/health` → `{"ok":true}`. Tabel ada di Supabase Studio.

### Phase 2 — Solana + Factory + Oracle (hari 1)

```
□ src/solana/{connection,signer,pda,instructions,decoder}.ts
□ src/scripts/init-factory.ts — bun run factory:init
□ src/scripts/spawn-market.ts — bun run market:spawn -- BTC 0
□ src/scripts/manual-oracle-update.ts — bun run oracle:update -- --identifier BTC --bps 2500
□ Verifikasi factory PDA + market PDA + oracle PDA di Solana Explorer (devnet)
```

**Acceptance**: `BTC` muncul di tabel `markets` dan di Solana Explorer.

### Phase 3 — Elfa + Pollers (hari 1-2)

```
□ src/elfa/{types,client,auto-client}.ts
□ src/services/trending-poller.ts
□ src/services/market-spawner.ts
□ src/services/oracle-updater.ts
□ src/services/metadata-enricher.ts
□ Wire ke src/index.ts: poller.start(), oracle.start()
□ Jalankan 30+ menit, verifikasi data masuk
```

**Acceptance**: Min 5 markets di DB dengan mindshare data setelah 30 menit.

### Phase 4 — API Routes (hari 2)

```
□ src/api/{health,markets,trending,search,resolve-link,webhooks}.ts
□ src/api/routes.ts
□ Test endpoint dengan curl/Postman
```

**Acceptance**: Semua endpoint return data valid.

### Phase 5 — Webhook + Auto + Realtime (hari 2-3)

```
□ src/api/webhooks.ts (Elfa + Helius)
□ src/services/auto-manager.ts + queue
□ src/services/trade-indexer.ts
□ Expose backend via ngrok untuk dev (atau deploy preview)
□ Register Elfa Auto webhook URL
□ Register Helius webhook untuk addresses = [TREDIE_PROGRAM_ID]
□ Frontend subscribe Realtime: supabase.channel('mkt').on('postgres_changes', ...)
```

**Acceptance**: Trade buy/sell → trades row → Realtime push → frontend chart bergerak.
Elfa hype event → HMAC verified → boost mindshare → oracle update.

### Phase 6 — Trade prepare + frontend integration (hari 3)

```
□ POST /api/v1/markets/prepare-trade (slippage calculation)
□ POST /api/v1/markets/prepare-create
□ Frontend sign + send tx via wallet (Privy)
□ End-to-end test: buy 0.1 SOL → confirmed → trade muncul di chart
```

---

## 13. Scripts

### `src/scripts/init-factory.ts`

```typescript
import { buildInitFactoryTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { factoryPda } from "../solana/pda";
import { connection } from "../solana/connection";

async function main() {
  const [factory] = factoryPda();
  const existing = await connection.getAccountInfo(factory);
  if (existing) {
    console.log(`Factory already initialized at ${factory.toBase58()}`);
    return;
  }

  const tx = await buildInitFactoryTx({
    feeRecipient: signer.publicKey,   // sementara: backend signer = fee recipient
    feeBasisPoints: 100,              // 1% protocol fee
  });
  const sig = await sendAndConfirm(tx);
  console.log(`Factory initialized: ${factory.toBase58()}`);
  console.log(`Signature: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

### `src/scripts/spawn-market.ts`

```typescript
// bun run market:spawn -- BTC 0
import { marketSpawner } from "../services/market-spawner";

const [identifier, assetClassRaw] = process.argv.slice(2);
if (!identifier) {
  console.error("Usage: bun run market:spawn -- <identifier> [assetClass=0]");
  process.exit(1);
}

const assetClass = Number(assetClassRaw ?? 0);

marketSpawner
  .ensureMarket({ identifier, assetClass, source: "auto_spawn" })
  .then((m) => { console.log("Market:", m.pda); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
```

### `src/scripts/manual-oracle-update.ts`

```typescript
// bun run oracle:update -- --identifier BTC --bps 2500
import { oracleUpdater } from "../services/oracle-updater";
import * as db from "../db";

const args = process.argv.slice(2);
const identifier = args[args.indexOf("--identifier") + 1];
const bps = Number(args[args.indexOf("--bps") + 1]);

if (!identifier || isNaN(bps)) {
  console.error("Usage: bun run oracle:update -- --identifier BTC --bps 2500");
  process.exit(1);
}

const market = await db.getMarketByIdentifier(identifier);
if (!market) { console.error(`Market "${identifier}" not in DB`); process.exit(1); }

await oracleUpdater.submit(market.pda, identifier, bps);
console.log("Done");
process.exit(0);
```

### `src/scripts/seed-markets.ts`

```typescript
import { marketSpawner } from "../services/market-spawner";
import { log } from "../utils/log";

const SEEDS = [
  { identifier: "BTC", assetClass: 0 },
  { identifier: "ETH", assetClass: 0 },
  { identifier: "SOL", assetClass: 0 },
  { identifier: "BONK", assetClass: 0 },
  { identifier: "WIF", assetClass: 0 },
  { identifier: "JUP", assetClass: 0 },
  { identifier: "xyz:NVDA", assetClass: 2, displayName: "Nvidia" },
  { identifier: "xyz:TSLA", assetClass: 2, displayName: "Tesla" },
  { identifier: "xyz:AAPL", assetClass: 2, displayName: "Apple" },
  { identifier: "xyz:XAU", assetClass: 3, displayName: "Gold" },
  { identifier: "xyz:CL", assetClass: 3, displayName: "Crude Oil" },
  { identifier: "xyz:DXY", assetClass: 4, displayName: "DXY" },
];

for (const s of SEEDS) {
  try {
    log.info({ identifier: s.identifier }, "Seeding...");
    await marketSpawner.ensureMarket({
      identifier: s.identifier,
      assetClass: s.assetClass,
      source: "auto_spawn",
      displayName: (s as any).displayName ?? null,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch (e: any) {
    log.error({ err: e.message, identifier: s.identifier }, "Seed failed");
  }
}
process.exit(0);
```

---

## 14. Error Handling & Logging

### `src/utils/log.ts`

```typescript
import pino from "pino";
import { config } from "../config";

export const log = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
```

### `src/utils/hmac.ts`

```typescript
import { createHash, createHmac } from "crypto";

export function sha256(data: string): Buffer {
  return createHash("sha256").update(data).digest();
}

export function hmacSha256Hex(key: Buffer, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}
```

### `src/utils/sleep.ts`

```typescript
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

### `src/index.ts` — Entry point

```typescript
import { serve } from "bun";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { buildRouter } from "./api/routes";
import { config } from "./config";
import { log } from "./utils/log";
import { trendingPoller } from "./services/trending-poller";
import { oracleUpdater } from "./services/oracle-updater";
import { startRotationCron } from "./services/auto-manager";

const app = buildRouter();

app.use("*", honoLogger());
app.use("*", cors({ origin: config.FRONTEND_URL, credentials: true }));

app.onError((err, c) => {
  log.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Boot background services
trendingPoller.start();
oracleUpdater.start();
startRotationCron();

log.info({ port: config.PORT, env: config.NODE_ENV }, "Tredie backend starting");

export default {
  port: config.PORT,
  fetch: app.fetch,
};
```

> **Bun idiom**: dengan `bun run --hot src/index.ts` dan `export default { fetch }`,
> Bun otomatis spin up HTTP server. Tidak perlu `serve()` manual.

---

## Quick Start

```bash
# 0. (One-time, kalau contract belum di-deploy ulang setelah asset_class extension)
#    Smart contract perlu support asset_class=6 untuk trend markets. Kalau program
#    yang di-deploy masih di constraint <=5, jalanin:
cd ../programs
anchor build
anchor upgrade target/deploy/tredie.so --program-id EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU --provider.cluster devnet

# 1. Install
cd backend
bun install

# 2. Buat Supabase project, copy connection string ke .env
cp .env.example .env
# Edit .env: DATABASE_URL, SUPABASE_*, SOLANA_RPC_URL, SIGNER_PRIVATE_KEY, ELFA_*, HELIUS_*

# 3. Run migrations (002_trend_class.sql akan extend CHECK constraint)
bun run db:migrate

# 4. Init on-chain factory (sekali aja, kalo belum)
bun run factory:init

# 5. Seed markets awal (termasuk trend:chinese-baddies, trend:ai-agents, dll)
bun run seed

# 6. Dev server
bun run dev

# 7. Smoke test
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/markets
curl 'http://localhost:4000/api/v1/search?q=BTC'
curl 'http://localhost:4000/api/v1/markets/trend:chinese-baddies'
```

### Frontend Realtime subscription (referensi)

```ts
// di Next.js frontend
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase.channel("trades")
  .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "trades", filter: `market_pda=eq.${marketPda}` },
      (payload) => console.log("New trade:", payload.new))
  .subscribe();

supabase.channel("mindshare")
  .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "mindshare_history", filter: `market_pda=eq.${marketPda}` },
      (payload) => updateChart(payload.new))
  .subscribe();
```

---

_Backend Tredie — Hono + Supabase Realtime + Postgres. Schema, services, dan route lengkap di dokumen ini._
_Jika smart contract berubah (instruction signature, account ordering, event fields), update `src/solana/instructions.ts` dan `src/solana/decoder.ts` sesuai source di `programs/programs/tredie/src`._
