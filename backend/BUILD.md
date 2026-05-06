# Tredie Backend — BUILD.md

Panduan implementasi lengkap backend Tredie. Baca seluruh dokumen sebelum mulai coding.
Backend adalah jembatan antara Elfa AI (data trending sosial), Solana devnet (on-chain program),
dan frontend (Next.js). Semua logika oracle update, market spawning, dan indexing ada di sini.

---

## Daftar Isi

1. [Tech Stack & Versions](#1-tech-stack--versions)
2. [Prerequisites](#2-prerequisites)
3. [Setup Awal](#3-setup-awal)
4. [Struktur Folder](#4-struktur-folder)
5. [Environment Variables](#5-environment-variables)
6. [Database](#6-database)
7. [Solana Integration](#7-solana-integration)
8. [Elfa AI Client](#8-elfa-ai-client)
9. [Services](#9-services)
10. [API Routes](#10-api-routes)
11. [Queue](#11-queue)
12. [Phase Build Order](#12-phase-build-order)
13. [Scripts](#13-scripts)
14. [Error Handling & Logging](#14-error-handling--logging)

---

## 1. Tech Stack & Versions

| Layer | Tech | Version |
|---|---|---|
| Runtime | Bun | latest |
| Framework | Express | 4.x |
| Language | TypeScript | 5.x |
| Database | better-sqlite3 | 9.x |
| Logging | pino + pino-pretty | latest |
| Solana SDK | @solana/web3.js | 1.x (legacy, stable) |
| Anchor client | @coral-xyz/anchor | 0.30.x |
| Queue | in-memory (dev), BullMQ (prod) | — |
| HTTP client | ky | latest |
| Scheduling | node-cron | latest |
| Validation | zod | 3.x |

> **Catatan**: Gunakan `@solana/web3.js` v1 (bukan v2/kit) untuk kompatibilitas dengan
> `@coral-xyz/anchor`. Frontend boleh pakai kit, tapi backend pakai v1.

---

## 2. Prerequisites

```bash
# Pastikan sudah ada:
bun --version          # >= 1.1.0
node --version         # >= 20.0.0 (untuk kompatibilitas)
solana --version       # >= 3.0.0

# API keys yang dibutuhkan:
# - Helius API key (devnet): https://dev.helius.xyz
# - Elfa API key: https://elfa.ai (PAYG tier minimum)
# - Elfa API secret (untuk Auto HMAC)
```

---

## 3. Setup Awal

```bash
cd tredie/backend

# Init project
bun init -y

# Install dependencies
bun add express @types/express
bun add typescript @types/node
bun add better-sqlite3 @types/better-sqlite3
bun add pino pino-pretty
bun add ky
bun add node-cron @types/node-cron
bun add zod
bun add dotenv
bun add @solana/web3.js
bun add @coral-xyz/anchor
bun add bs58
bun add cors @types/cors

# Dev dependencies
bun add -d tsx
bun add -d @types/bs58
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "tsx src/db/migrate.ts",
    "oracle:update": "tsx src/scripts/manual-oracle-update.ts",
    "market:spawn": "tsx src/scripts/spawn-market.ts",
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
    ├── index.ts                ← entry point, setup Express + services
    ├── config.ts               ← load & validate env vars
    ├── db/
    │   ├── index.ts            ← singleton SQLite connection
    │   ├── migrate.ts          ← jalankan migrations
    │   └── migrations/
    │       └── 001_initial.sql
    ├── elfa/
    │   ├── client.ts           ← REST client (trending, top-mentions, chat)
    │   ├── auto-client.ts      ← Auto API client (HMAC signed)
    │   └── types.ts            ← TypeScript types untuk Elfa responses
    ├── solana/
    │   ├── connection.ts       ← Connection singleton
    │   ├── signer.ts           ← Keypair loader dari env
    │   ├── program.ts          ← Anchor Program instance
    │   ├── pda.ts              ← PDA derivation helpers
    │   └── instructions.ts     ← build unsigned transactions
    ├── services/
    │   ├── trending-poller.ts
    │   ├── market-spawner.ts
    │   ├── oracle-updater.ts
    │   ├── auto-manager.ts
    │   ├── webhook-receiver.ts
    │   ├── event-processor.ts
    │   ├── metadata-enricher.ts
    │   ├── link-resolver.ts
    │   ├── symbol-extractor.ts
    │   └── trade-indexer.ts
    ├── api/
    │   ├── routes.ts           ← register semua routes
    │   ├── markets.ts
    │   ├── trending.ts
    │   ├── search.ts
    │   ├── resolve-link.ts
    │   └── health.ts
    ├── queue/
    │   └── index.ts            ← in-memory queue (dev)
    ├── utils/
    │   ├── hmac.ts
    │   ├── log.ts
    │   └── sleep.ts
    └── scripts/
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

# ── Solana ─────────────────────────────────────────────────────────────────
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
SOLANA_NETWORK=devnet
TREDIE_PROGRAM_ID=EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU

# Private key backend signer sebagai array JSON (bukan base58)
# Generate: solana-keygen new --outfile backend-signer.json
# Lalu copy isi file JSON (array of numbers) ke sini
SIGNER_PRIVATE_KEY=[1,2,3,...,64]

HELIUS_API_KEY=YOUR_HELIUS_KEY
HELIUS_WEBHOOK_SECRET=YOUR_HELIUS_WEBHOOK_SECRET

# ── Elfa ───────────────────────────────────────────────────────────────────
ELFA_API_KEY=YOUR_ELFA_API_KEY
ELFA_API_SECRET=YOUR_ELFA_API_SECRET
ELFA_API_BASE=https://api.elfa.ai
ELFA_AUTO_WEBHOOK_SECRET=YOUR_ELFA_AUTO_WEBHOOK_SECRET

# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=./data/tredie.sqlite

# ── Queue (optional, hanya untuk prod) ─────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Frontend ────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# ── Telegram (optional) ────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ── Thresholds ──────────────────────────────────────────────────────────────
AUTO_SPAWN_THRESHOLD_PCT=0.5      # Spawn market jika mindshare > 0.5%
CA_SPAWN_THRESHOLD=500            # Spawn CA market jika mentions > 500
HYPE_EVENT_PREMIUM_BPS=500        # Boost mindshare saat hype event
```

### `src/config.ts`

```typescript
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta', 'localnet']).default('devnet'),
  TREDIE_PROGRAM_ID: z.string(),
  SIGNER_PRIVATE_KEY: z.string(),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_SECRET: z.string().default(''),

  ELFA_API_KEY: z.string(),
  ELFA_API_SECRET: z.string().default(''),
  ELFA_API_BASE: z.string().url().default('https://api.elfa.ai'),
  ELFA_AUTO_WEBHOOK_SECRET: z.string().default(''),

  DATABASE_URL: z.string().default('./data/tredie.sqlite'),
  REDIS_URL: z.string().optional(),

  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().default('http://localhost:4000'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  AUTO_SPAWN_THRESHOLD_PCT: z.string().default('0.5').transform(Number),
  CA_SPAWN_THRESHOLD: z.string().default('500').transform(Number),
  HYPE_EVENT_PREMIUM_BPS: z.string().default('500').transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
```

---

## 6. Database

### `src/db/migrations/001_initial.sql`

Jalankan dengan `bun run db:migrate` sebelum start server.

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── Markets (mirror on-chain state) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  pda                   TEXT    UNIQUE NOT NULL,
  mint                  TEXT    UNIQUE NOT NULL,
  identifier            TEXT    NOT NULL UNIQUE,
  asset_class           INTEGER NOT NULL CHECK(asset_class BETWEEN 0 AND 5),
  -- 0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA
  display_name          TEXT,
  description           TEXT,
  image_url             TEXT,
  source_url            TEXT,
  source_metadata_json  TEXT,
  base_virtual_sol      INTEGER NOT NULL,
  virtual_token_supply  INTEGER NOT NULL,
  real_sol_reserves     INTEGER NOT NULL DEFAULT 0,
  tokens_minted         INTEGER NOT NULL DEFAULT 0,
  current_mindshare_bps INTEGER NOT NULL DEFAULT 0,
  peak_mindshare_bps    INTEGER NOT NULL DEFAULT 0,
  ratchet_multiplier_bps INTEGER NOT NULL DEFAULT 10000,
  creator_pubkey        TEXT    NOT NULL,
  creator_source        TEXT    NOT NULL DEFAULT 'auto_spawn',
  -- 'auto_spawn' | 'user_search' | 'user_link_paste'
  created_at            INTEGER NOT NULL,
  last_synced_slot      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_markets_asset_class  ON markets(asset_class);
CREATE INDEX IF NOT EXISTS idx_markets_mindshare    ON markets(current_mindshare_bps DESC);
CREATE INDEX IF NOT EXISTS idx_markets_identifier   ON markets(identifier);
CREATE INDEX IF NOT EXISTS idx_markets_creator      ON markets(creator_pubkey);

-- ── Trade history ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  signature    TEXT    UNIQUE NOT NULL,
  market_pda   TEXT    NOT NULL,
  side         INTEGER NOT NULL CHECK(side IN (0,1)), -- 0=buy 1=sell
  trader       TEXT    NOT NULL,
  sol_amount   INTEGER NOT NULL,
  token_amount INTEGER NOT NULL,
  ratchet_bps  INTEGER NOT NULL,
  block_time   INTEGER NOT NULL,
  slot         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_market     ON trades(market_pda);
CREATE INDEX IF NOT EXISTS idx_trades_block_time ON trades(block_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader     ON trades(trader);

-- ── Mindshare history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mindshare_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  market_pda   TEXT    NOT NULL,
  current_bps  INTEGER NOT NULL,
  peak_bps     INTEGER NOT NULL,
  ratchet_bps  INTEGER NOT NULL,
  source       TEXT    NOT NULL, -- 'rest_poll' | 'auto_event'
  recorded_at  INTEGER NOT NULL,
  tx_signature TEXT
);

CREATE INDEX IF NOT EXISTS idx_mindshare_market ON mindshare_history(market_pda, recorded_at DESC);

-- ── Trending tokens cache ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol        TEXT    NOT NULL,
  mention_count INTEGER NOT NULL,
  mindshare_pct REAL,
  rank_position INTEGER,
  fetched_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trending_tokens_fetched ON trending_tokens(fetched_at DESC);

-- ── Trending CAs cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trending_cas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_address TEXT    NOT NULL,
  source_platform  TEXT    NOT NULL CHECK(source_platform IN ('twitter','telegram')),
  mention_count    INTEGER NOT NULL,
  rank_position    INTEGER,
  fetched_at       INTEGER NOT NULL,
  UNIQUE(contract_address, source_platform, fetched_at)
);

CREATE INDEX IF NOT EXISTS idx_trending_cas_fetched   ON trending_cas(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_cas_platform  ON trending_cas(source_platform);

-- ── Token metadata cache (untuk CAs) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_metadata (
  contract_address TEXT    PRIMARY KEY,
  symbol           TEXT,
  name             TEXT,
  image_url        TEXT,
  decimals         INTEGER,
  total_supply     TEXT,
  source           TEXT, -- 'helius_das' | 'jupiter' | 'manual'
  fetched_at       INTEGER NOT NULL
);

-- ── Auto queries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_queries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  query_id    TEXT    UNIQUE NOT NULL,
  query_type  TEXT    NOT NULL,
  market_pda  TEXT,
  config_json TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active',
  -- 'active' | 'cancelled' | 'expired'
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER
);

-- ── Auto events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT    UNIQUE NOT NULL,
  query_id     TEXT    NOT NULL,
  channel      TEXT    NOT NULL,
  payload_json TEXT    NOT NULL,
  received_at  INTEGER NOT NULL,
  processed_at INTEGER,
  outcome      TEXT
);

CREATE INDEX IF NOT EXISTS idx_auto_events_query ON auto_events(query_id);

-- ── Link cache ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS link_cache (
  url              TEXT    PRIMARY KEY,
  platform         TEXT    NOT NULL,
  metadata_json    TEXT    NOT NULL,
  extracted_symbol TEXT,
  resolved_at      INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL
);
```

### `src/db/index.ts`

```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { config } from '../config';
import { log } from '../utils/log';

// Pastikan folder data/ ada
mkdirSync('./data', { recursive: true });

export const db = new Database(config.DATABASE_URL, {
  verbose: config.NODE_ENV === 'development' ? undefined : undefined,
});

// ── Helpers ──────────────────────────────────────────────────────────────

export function getMarketByIdentifier(identifier: string) {
  return db.prepare('SELECT * FROM markets WHERE identifier = ?').get(identifier) as MarketRow | undefined;
}

export function getMarketByPda(pda: string) {
  return db.prepare('SELECT * FROM markets WHERE pda = ?').get(pda) as MarketRow | undefined;
}

export function getAllActiveMarkets(): MarketRow[] {
  return db.prepare('SELECT * FROM markets ORDER BY current_mindshare_bps DESC').all() as MarketRow[];
}

export function upsertMarket(market: Partial<MarketRow> & { identifier: string; pda: string }) {
  return db.prepare(`
    INSERT INTO markets (pda, mint, identifier, asset_class, display_name, image_url, source_url,
      base_virtual_sol, virtual_token_supply, real_sol_reserves, tokens_minted,
      creator_pubkey, creator_source, created_at, last_synced_slot)
    VALUES (@pda, @mint, @identifier, @asset_class, @display_name, @image_url, @source_url,
      @base_virtual_sol, @virtual_token_supply, @real_sol_reserves, @tokens_minted,
      @creator_pubkey, @creator_source, @created_at, @last_synced_slot)
    ON CONFLICT(identifier) DO UPDATE SET
      real_sol_reserves = excluded.real_sol_reserves,
      tokens_minted = excluded.tokens_minted,
      last_synced_slot = excluded.last_synced_slot,
      display_name = COALESCE(excluded.display_name, display_name),
      image_url = COALESCE(excluded.image_url, image_url)
  `).run(market);
}

// ratchetBps = display-only, tidak mempengaruhi harga on-chain
export function updateMarketMindshare(pda: string, currentBps: number, peakBps: number, ratchetBps: number) {
  return db.prepare(`
    UPDATE markets
    SET current_mindshare_bps = ?, peak_mindshare_bps = ?, ratchet_multiplier_bps = ?
    WHERE pda = ?
  `).run(currentBps, peakBps, ratchetBps, pda);
}

export function upsertTrendingToken(data: {
  symbol: string; mention_count: number; mindshare_pct?: number; rank_position?: number; fetched_at: number;
}) {
  return db.prepare(`
    INSERT INTO trending_tokens (symbol, mention_count, mindshare_pct, rank_position, fetched_at)
    VALUES (@symbol, @mention_count, @mindshare_pct, @rank_position, @fetched_at)
  `).run(data);
}

export function getLatestTrendingToken(symbol: string) {
  return db.prepare(
    'SELECT * FROM trending_tokens WHERE symbol = ? ORDER BY fetched_at DESC LIMIT 1'
  ).get(symbol) as TrendingTokenRow | undefined;
}

export function upsertTrendingCA(data: {
  contract_address: string; source_platform: string;
  mention_count: number; rank_position?: number; fetched_at: number;
}) {
  return db.prepare(`
    INSERT OR REPLACE INTO trending_cas (contract_address, source_platform, mention_count, rank_position, fetched_at)
    VALUES (@contract_address, @source_platform, @mention_count, @rank_position, @fetched_at)
  `).run(data);
}

export function appendMindshareHistory(data: {
  market_pda: string; current_bps: number; peak_bps?: number;
  ratchet_bps?: number; source: string; recorded_at: number; tx_signature?: string;
}) {
  return db.prepare(`
    INSERT INTO mindshare_history (market_pda, current_bps, peak_bps, ratchet_bps, source, recorded_at, tx_signature)
    VALUES (@market_pda, @current_bps, @peak_bps, @ratchet_bps, @source, @recorded_at, @tx_signature)
  `).run({ peak_bps: 0, ratchet_bps: 10000, tx_signature: null, ...data });
}

export function getLastMindshareEntry(marketPda: string) {
  return db.prepare(
    'SELECT * FROM mindshare_history WHERE market_pda = ? ORDER BY recorded_at DESC LIMIT 1'
  ).get(marketPda) as MindshareHistoryRow | undefined;
}

export function getMindshareHistory(marketPda: string, limit = 100): MindshareHistoryRow[] {
  return db.prepare(
    'SELECT * FROM mindshare_history WHERE market_pda = ? ORDER BY recorded_at ASC LIMIT ?'
  ).all(marketPda, limit) as MindshareHistoryRow[];
}

export function getRecentTrades(marketPda: string, limit = 50): TradeRow[] {
  return db.prepare(
    'SELECT * FROM trades WHERE market_pda = ? ORDER BY block_time DESC LIMIT ?'
  ).all(marketPda, limit) as TradeRow[];
}

export function upsertTrade(trade: Omit<TradeRow, 'id'>) {
  return db.prepare(`
    INSERT OR IGNORE INTO trades (signature, market_pda, side, trader, sol_amount, token_amount, ratchet_bps, block_time, slot)
    VALUES (@signature, @market_pda, @side, @trader, @sol_amount, @token_amount, @ratchet_bps, @block_time, @slot)
  `).run(trade);
}

export function getTokenMetadata(address: string) {
  return db.prepare('SELECT * FROM token_metadata WHERE contract_address = ?').get(address) as TokenMetadataRow | undefined;
}

export function cacheTokenMetadata(meta: TokenMetadataRow) {
  return db.prepare(`
    INSERT OR REPLACE INTO token_metadata (contract_address, symbol, name, image_url, decimals, total_supply, source, fetched_at)
    VALUES (@contract_address, @symbol, @name, @image_url, @decimals, @total_supply, @source, @fetched_at)
  `).run(meta);
}

export function insertAutoQuery(data: {
  query_id: string; query_type: string; market_pda?: string;
  config_json: string; status: string; created_at: number; expires_at?: number;
}) {
  return db.prepare(`
    INSERT OR IGNORE INTO auto_queries (query_id, query_type, market_pda, config_json, status, created_at, expires_at)
    VALUES (@query_id, @query_type, @market_pda, @config_json, @status, @created_at, @expires_at)
  `).run(data);
}

export function getAutoQuery(queryId: string) {
  return db.prepare('SELECT * FROM auto_queries WHERE query_id = ?').get(queryId) as AutoQueryRow | undefined;
}

export function getAutoQueriesExpiringSoon(withinMs: number): AutoQueryRow[] {
  const threshold = Date.now() + withinMs;
  return db.prepare(
    "SELECT * FROM auto_queries WHERE status = 'active' AND expires_at <= ?"
  ).all(threshold) as AutoQueryRow[];
}

export function upsertAutoEvent(data: { event_id: string; query_id: string; channel: string; payload_json: string; received_at: number }) {
  return db.prepare(`
    INSERT OR IGNORE INTO auto_events (event_id, query_id, channel, payload_json, received_at)
    VALUES (@event_id, @query_id, @channel, @payload_json, @received_at)
  `).run(data);
}

export function autoEventExists(eventId: string): boolean {
  const row = db.prepare('SELECT id FROM auto_events WHERE event_id = ?').get(eventId);
  return row != null;
}

export function markAutoEventProcessed(eventId: string, outcome: string) {
  return db.prepare(
    'UPDATE auto_events SET processed_at = ?, outcome = ? WHERE event_id = ?'
  ).run(Date.now(), outcome, eventId);
}

export function getLinkCache(url: string) {
  return db.prepare('SELECT * FROM link_cache WHERE url = ?').get(url) as LinkCacheRow | undefined;
}

export function cacheLinkResolution(url: string, platform: string, metadata: object, extractedSymbol?: string) {
  return db.prepare(`
    INSERT OR REPLACE INTO link_cache (url, platform, metadata_json, extracted_symbol, resolved_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(url, platform, JSON.stringify(metadata), extractedSymbol ?? null, Date.now(), Date.now() + 86400000);
}

// ── TypeScript row types ──────────────────────────────────────────────────

export interface MarketRow {
  id: number; pda: string; mint: string; identifier: string;
  asset_class: number; display_name?: string; description?: string;
  image_url?: string; source_url?: string; source_metadata_json?: string;
  base_virtual_sol: number; virtual_token_supply: number;
  real_sol_reserves: number; tokens_minted: number;
  current_mindshare_bps: number; peak_mindshare_bps: number;
  ratchet_multiplier_bps: number; creator_pubkey: string;
  creator_source: string; created_at: number; last_synced_slot: number;
}

export interface TradeRow {
  id?: number; signature: string; market_pda: string; side: number;
  trader: string; sol_amount: number; token_amount: number;
  ratchet_bps: number; block_time: number; slot: number;
}

export interface MindshareHistoryRow {
  id?: number; market_pda: string; current_bps: number;
  peak_bps: number; ratchet_bps: number; source: string;
  recorded_at: number; tx_signature?: string;
}

export interface TrendingTokenRow {
  id?: number; symbol: string; mention_count: number;
  mindshare_pct?: number; rank_position?: number; fetched_at: number;
}

export interface TrendingCARow {
  id?: number; contract_address: string; source_platform: string;
  mention_count: number; rank_position?: number; fetched_at: number;
}

export interface TokenMetadataRow {
  contract_address: string; symbol?: string; name?: string;
  image_url?: string; decimals?: number; total_supply?: string;
  source?: string; fetched_at: number;
}

export interface AutoQueryRow {
  id?: number; query_id: string; query_type: string;
  market_pda?: string; config_json: string; status: string;
  created_at: number; expires_at?: number;
}

export interface LinkCacheRow {
  url: string; platform: string; metadata_json: string;
  extracted_symbol?: string; resolved_at: number; expires_at: number;
}
```

---

## 7. Solana Integration

### `src/solana/connection.ts`

```typescript
import { Connection } from '@solana/web3.js';
import { config } from '../config';

export const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
```

### `src/solana/signer.ts`

```typescript
import { Keypair } from '@solana/web3.js';
import { config } from '../config';

function loadSigner(): Keypair {
  try {
    const keyArray = JSON.parse(config.SIGNER_PRIVATE_KEY) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(keyArray));
  } catch {
    throw new Error('SIGNER_PRIVATE_KEY harus berupa JSON array of numbers');
  }
}

export const signer = loadSigner();

export function getSignerPublicKey(): string {
  return signer.publicKey.toBase58();
}
```

### `src/solana/pda.ts`

```typescript
import { PublicKey } from '@solana/web3.js';
import { config } from '../config';

const PROGRAM_ID = new PublicKey(config.TREDIE_PROGRAM_ID);

const FACTORY_SEED = Buffer.from('factory');
const MARKET_SEED  = Buffer.from('market');
const ORACLE_SEED  = Buffer.from('oracle');

export function factoryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FACTORY_SEED], PROGRAM_ID);
}

// identifier harus 32 bytes, padded dengan zeros
export function identifierToBytes(identifier: string): Buffer {
  const bytes = Buffer.from(identifier, 'utf-8');
  if (bytes.length > 32) throw new Error(`Identifier "${identifier}" melebihi 32 bytes`);
  const padded = Buffer.alloc(32, 0);
  bytes.copy(padded);
  return padded;
}

export function marketPda(identifier: string): [PublicKey, number] {
  const idBytes = identifierToBytes(identifier);
  return PublicKey.findProgramAddressSync([MARKET_SEED, idBytes], PROGRAM_ID);
}

export function oraclePda(marketPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ORACLE_SEED, marketPubkey.toBuffer()], PROGRAM_ID);
}

export function derivedMintFromMarket(identifier: string): PublicKey {
  // Mint adalah Keypair biasa, bukan PDA. Kita simpan di DB saat create_market.
  // Fungsi ini tidak applicable — gunakan db.getMarketByIdentifier(identifier).mint
  throw new Error('Mint bukan PDA, ambil dari database');
}
```

### `src/solana/instructions.ts`

```typescript
import {
  PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { connection } from './connection';
import { signer } from './signer';
import { factoryPda, marketPda, oraclePda, identifierToBytes } from './pda';
import { config } from '../config';
import * as db from '../db';

const PROGRAM_ID = new PublicKey(config.TREDIE_PROGRAM_ID);

// ── Discriminators (sha256("global:<name>")[..8]) ─────────────────────────
import { createHash } from 'crypto';
function disc(name: string): Buffer {
  return Buffer.from(createHash('sha256').update(`global:${name}`).digest()).subarray(0, 8);
}

// ── create_market ─────────────────────────────────────────────────────────
export async function buildCreateMarketTx(params: {
  identifier: string;
  assetClass: number;
  mintKeypairPublicKey: PublicKey;
  oracleAuthority: PublicKey;
  baseVirtualSol?: bigint;
  virtualTokenSupply?: bigint;
  elasticityBps?: number;
}): Promise<Transaction> {
  const {
    identifier,
    assetClass,
    mintKeypairPublicKey,
    oracleAuthority,
    baseVirtualSol = BigInt(30_000_000_000),
    virtualTokenSupply = BigInt(1_000_000_000_000_000),
    elasticityBps = 5000,
  } = params;

  const idBytes = identifierToBytes(identifier);
  const idLen = Buffer.from(identifier, 'utf-8').length;

  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);

  // Encode instruction data
  const data = Buffer.concat([
    disc('create_market'),
    idBytes,                                           // [u8; 32]
    Buffer.from([idLen]),                              // u8
    Buffer.from([assetClass]),                         // u8
    Buffer.from(baseVirtualSol.toString(16).padStart(16, '0'), 'hex').reverse(), // u64 LE
    Buffer.from(virtualTokenSupply.toString(16).padStart(16, '0'), 'hex').reverse(), // u64 LE
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(elasticityBps); return b; })(), // u32
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: factory,                isSigner: false, isWritable: true  },
      { pubkey: market,                 isSigner: false, isWritable: true  },
      { pubkey: mintKeypairPublicKey,   isSigner: true,  isWritable: true  },
      { pubkey: oracle,                 isSigner: false, isWritable: true  },
      { pubkey: signer.publicKey,       isSigner: true,  isWritable: true  },
      { pubkey: oracleAuthority,        isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,     isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}

// ── update_mindshare ──────────────────────────────────────────────────────
export async function buildUpdateMindshareTx(params: {
  identifier: string;
  newMindshareBps: number;
}): Promise<Transaction> {
  const { identifier, newMindshareBps } = params;
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);

  const data = Buffer.concat([
    disc('update_mindshare'),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(newMindshareBps); return b; })(),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: market,         isSigner: false, isWritable: false },
      { pubkey: oracle,         isSigner: false, isWritable: true  },
      { pubkey: signer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}

// ── build buy/sell (untuk frontend, di-sign oleh user) ───────────────────
export async function buildBuyTx(params: {
  buyer: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  solAmountIn: bigint;
  minTokensOut: bigint;
}): Promise<Transaction> {
  const { buyer, identifier, mintPubkey, solAmountIn, minTokensOut } = params;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);

  const factoryData = await connection.getAccountInfo(factory);
  if (!factoryData) throw new Error('Factory account tidak ditemukan');
  // fee_recipient ada di offset 41 (8 disc + 1 bump + 32 authority)
  const feeRecipient = new PublicKey(factoryData.data.slice(41, 73));

  const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyer);

  const data = Buffer.concat([
    disc('buy'),
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(solAmountIn); return b; })(),
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(minTokensOut); return b; })(),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: factory,                     isSigner: false, isWritable: false },
      { pubkey: market,                      isSigner: false, isWritable: true  },
      { pubkey: mintPubkey,                  isSigner: false, isWritable: true  },
      { pubkey: oracle,                      isSigner: false, isWritable: false },
      { pubkey: buyerAta,                    isSigner: false, isWritable: true  },
      { pubkey: feeRecipient,                isSigner: false, isWritable: true  },
      { pubkey: buyer,                       isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = buyer;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}

export async function buildSellTx(params: {
  seller: PublicKey;
  identifier: string;
  mintPubkey: PublicKey;
  tokensIn: bigint;
  minSolOut: bigint;
}): Promise<Transaction> {
  const { seller, identifier, mintPubkey, tokensIn, minSolOut } = params;
  const [factory] = factoryPda();
  const [market] = marketPda(identifier);
  const [oracle] = oraclePda(market);

  const factoryData = await connection.getAccountInfo(factory);
  if (!factoryData) throw new Error('Factory account tidak ditemukan');
  const feeRecipient = new PublicKey(factoryData.data.slice(41, 73));

  const sellerAta = await getAssociatedTokenAddress(mintPubkey, seller);

  const data = Buffer.concat([
    disc('sell'),
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(tokensIn); return b; })(),
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(minSolOut); return b; })(),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: factory,                     isSigner: false, isWritable: false },
      { pubkey: market,                      isSigner: false, isWritable: true  },
      { pubkey: mintPubkey,                  isSigner: false, isWritable: true  },
      { pubkey: oracle,                      isSigner: false, isWritable: false },
      { pubkey: sellerAta,                   isSigner: false, isWritable: true  },
      { pubkey: feeRecipient,                isSigner: false, isWritable: true  },
      { pubkey: seller,                      isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = seller;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}

// ── send + confirm ────────────────────────────────────────────────────────
export async function sendAndConfirm(tx: Transaction, additionalSigners: import('@solana/web3.js').Keypair[] = []): Promise<string> {
  tx.sign(signer, ...additionalSigners);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}
```

---

## 8. Elfa AI Client

### `src/elfa/types.ts`

```typescript
export interface TrendingToken {
  symbol: string;
  mention_count: number;
  mindshare_pct: number;
  rank?: number;
}

export interface TrendingCA {
  contract_address: string;
  mention_count: number;
  rank?: number;
}

export interface TopMentionItem {
  symbol: string;
  total_mentions: number;
  timeframe: string;
}

export interface ElfaAutoQuery {
  title: string;
  conditions: object;
  actions: { stepId: string; type: string; params: object }[];
  expiresIn: string;
}

export interface ElfaAutoQueryResult {
  queryId: string;
  status: string;
}

export interface ElfaValidateResult {
  valid: boolean;
  errors?: string[];
}

export interface ElfaChatResponse {
  answer: string;
  sources?: string[];
}
```

### `src/elfa/client.ts`

```typescript
import ky from 'ky';
import { config } from '../config';
import type { TrendingToken, TrendingCA, TopMentionItem, ElfaChatResponse } from './types';

const elfa = ky.create({
  prefixUrl: config.ELFA_API_BASE,
  headers: { 'x-elfa-api-key': config.ELFA_API_KEY },
  timeout: 30_000,
  retry: { limit: 3, delay: () => 2000 },
});

// GET /v2/aggregations/trending-tokens
export async function getTrendingTokens(timeWindow = '1h', minMentions = 10): Promise<TrendingToken[]> {
  const res = await elfa.get('v2/aggregations/trending-tokens', {
    searchParams: { timeWindow, minMentions },
  }).json<{ data: TrendingToken[] }>();
  return res.data ?? [];
}

// GET /v2/aggregations/trending-cas/twitter
export async function getTrendingCAsTwitter(timeWindow = '1h'): Promise<TrendingCA[]> {
  const res = await elfa.get('v2/aggregations/trending-cas/twitter', {
    searchParams: { timeWindow },
  }).json<{ data: TrendingCA[] }>();
  return res.data ?? [];
}

// GET /v2/aggregations/trending-cas/telegram
export async function getTrendingCAsTelegram(timeWindow = '1h'): Promise<TrendingCA[]> {
  const res = await elfa.get('v2/aggregations/trending-cas/telegram', {
    searchParams: { timeWindow },
  }).json<{ data: TrendingCA[] }>();
  return res.data ?? [];
}

// GET /v2/data/top-mentions
export async function getTopMentions(symbol: string, timeWindow = '1h'): Promise<TopMentionItem[]> {
  const res = await elfa.get('v2/data/top-mentions', {
    searchParams: { symbol, timeWindow },
  }).json<{ data: TopMentionItem[] }>();
  return res.data ?? [];
}

// POST /v2/chat
export async function elfaChat(query: string, speed: 'fast' | 'balanced' = 'fast'): Promise<ElfaChatResponse> {
  return elfa.post('v2/chat', { json: { query, speed } }).json<ElfaChatResponse>();
}

// Konversi mindshare_pct (contoh: 2.5) → mindshare_bps (2500)
export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}
```

### `src/elfa/auto-client.ts`

```typescript
import ky from 'ky';
import { createHash, createHmac } from 'crypto';
import { config } from '../config';
import type { ElfaAutoQuery, ElfaAutoQueryResult, ElfaValidateResult } from './types';

function hmacSign(body: string): { signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signingKey = createHash('sha256').update(config.ELFA_API_SECRET).digest();
  const signature = 'v1=' + createHmac('sha256', signingKey)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return { signature, timestamp };
}

const elfaAuto = ky.create({
  prefixUrl: config.ELFA_API_BASE,
  headers: { 'x-elfa-api-key': config.ELFA_API_KEY },
  timeout: 30_000,
});

export async function validateQuery(query: ElfaAutoQuery): Promise<ElfaValidateResult> {
  const body = JSON.stringify(query);
  const { signature, timestamp } = hmacSign(body);
  return elfaAuto.post('v2/auto/queries/validate', {
    body,
    headers: { 'x-auto-signature': signature, 'x-auto-signature-timestamp': timestamp },
  }).json<ElfaValidateResult>();
}

export async function createQuery(query: ElfaAutoQuery): Promise<ElfaAutoQueryResult> {
  const body = JSON.stringify(query);
  const { signature, timestamp } = hmacSign(body);
  return elfaAuto.post('v2/auto/queries', {
    body,
    headers: { 'x-auto-signature': signature, 'x-auto-signature-timestamp': timestamp },
  }).json<ElfaAutoQueryResult>();
}

export async function cancelQuery(queryId: string): Promise<void> {
  const body = '';
  const { signature, timestamp } = hmacSign(body);
  await elfaAuto.post(`v2/auto/queries/${queryId}/cancel`, {
    headers: { 'x-auto-signature': signature, 'x-auto-signature-timestamp': timestamp },
  });
}

export async function validateSymbol(symbol: string): Promise<{ supported: boolean }> {
  try {
    const res = await elfaAuto.get(`v2/auto/validate-symbol/${encodeURIComponent(symbol)}`).json<{ supported: boolean }>();
    return res;
  } catch {
    return { supported: false };
  }
}
```

---

## 9. Services

### `src/services/trending-poller.ts`

Cron setiap 15 menit. Polls 3 Elfa endpoints, simpan ke DB, trigger auto-spawn jika perlu.

```typescript
import cron from 'node-cron';
import * as elfa from '../elfa/client';
import * as db from '../db';
import { config } from '../config';
import { log } from '../utils/log';
import { marketSpawner } from './market-spawner';
import { metadataEnricher } from './metadata-enricher';

export class TrendingPoller {
  start() {
    // Jalankan langsung sekali, lalu tiap 15 menit
    this.pollAll().catch(e => log.error({ err: e }, 'Initial poll failed'));
    cron.schedule('*/15 * * * *', () => {
      this.pollAll().catch(e => log.error({ err: e }, 'Scheduled poll failed'));
    });
    log.info('TrendingPoller started (every 15 minutes)');
  }

  async pollAll() {
    await Promise.allSettled([
      this.pollTrendingTokens(),
      this.pollTrendingCAs('twitter'),
      this.pollTrendingCAs('telegram'),
    ]);
  }

  async pollTrendingTokens() {
    log.debug('Polling trending tokens...');
    const tokens = await elfa.getTrendingTokens('1h', 10);

    for (const [idx, token] of tokens.entries()) {
      db.upsertTrendingToken({
        symbol: token.symbol,
        mention_count: token.mention_count,
        mindshare_pct: token.mindshare_pct,
        rank_position: idx + 1,
        fetched_at: Date.now(),
      });

      // Auto-spawn jika mindshare cukup tinggi
      const pct = token.mindshare_pct ?? 0;
      if (pct > config.AUTO_SPAWN_THRESHOLD_PCT) {
        const existing = db.getMarketByIdentifier(token.symbol);
        if (!existing) {
          marketSpawner.ensureMarket({
            identifier: token.symbol,
            assetClass: detectAssetClass(token.symbol),
            source: 'auto_spawn',
          }).catch(e => log.warn({ err: e, symbol: token.symbol }, 'Auto-spawn failed'));
        }
      }
    }

    log.info({ count: tokens.length }, 'Trending tokens polled');
  }

  async pollTrendingCAs(platform: 'twitter' | 'telegram') {
    log.debug({ platform }, 'Polling trending CAs...');
    const cas = platform === 'twitter'
      ? await elfa.getTrendingCAsTwitter('1h')
      : await elfa.getTrendingCAsTelegram('1h');

    for (const [idx, ca] of cas.entries()) {
      db.upsertTrendingCA({
        contract_address: ca.contract_address,
        source_platform: platform,
        mention_count: ca.mention_count,
        rank_position: idx + 1,
        fetched_at: Date.now(),
      });

      // Enrich metadata
      metadataEnricher.fetch(ca.contract_address).catch(() => {});

      // Auto-spawn jika mention count cukup
      if (ca.mention_count > config.CA_SPAWN_THRESHOLD) {
        const existing = db.getMarketByIdentifier(ca.contract_address);
        if (!existing) {
          const meta = db.getTokenMetadata(ca.contract_address);
          marketSpawner.ensureMarket({
            identifier: ca.contract_address,
            assetClass: 5, // CA class
            source: 'auto_spawn',
            displayName: meta?.symbol ?? meta?.name ?? undefined,
            imageUrl: meta?.image_url ?? undefined,
          }).catch(e => log.warn({ err: e, ca: ca.contract_address }, 'CA auto-spawn failed'));
        }
      }
    }

    log.info({ platform, count: cas.length }, 'Trending CAs polled');
  }
}

// Deteksi asset class dari symbol
function detectAssetClass(symbol: string): number {
  if (symbol.startsWith('xyz:')) {
    const base = symbol.slice(4);
    // Forex pairs biasanya 6 karakter
    if (/^[A-Z]{6}$/.test(base)) return 4; // FX
    // Commodity keywords
    if (['XAU', 'XAG', 'CL', 'NG', 'HG', 'ZW', 'ZC'].includes(base)) return 3;
    return 2; // Default: equity
  }
  // Semua yang tidak ada prefix = crypto
  return 0;
}

export const trendingPoller = new TrendingPoller();
```

### `src/services/market-spawner.ts`

```typescript
import { Keypair } from '@solana/web3.js';
import { buildCreateMarketTx, sendAndConfirm } from '../solana/instructions';
import { signer } from '../solana/signer';
import { marketPda, oraclePda } from '../solana/pda';
import { connection } from '../solana/connection';
import * as db from '../db';
import * as autoManager from './auto-manager';
import { log } from '../utils/log';

const DEFAULT_BASE_VIRTUAL_SOL = BigInt(30_000_000_000);    // 30 SOL
const DEFAULT_VIRTUAL_TOKEN_SUPPLY = BigInt(1_000_000_000_000_000); // 1B × 10^6
const DEFAULT_ELASTICITY_BPS = 5000;

export class MarketSpawner {
  private pending = new Set<string>(); // prevent concurrent spawn for same identifier

  async ensureMarket(params: {
    identifier: string;
    assetClass: number;
    source: 'auto_spawn' | 'user_search' | 'user_link_paste';
    displayName?: string;
    imageUrl?: string;
    sourceUrl?: string;
    sourceMetadata?: object;
  }): Promise<db.MarketRow> {
    const { identifier } = params;

    // Idempotency check
    const existing = db.getMarketByIdentifier(identifier);
    if (existing) return existing;

    // Prevent duplicate concurrent spawns
    if (this.pending.has(identifier)) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return db.getMarketByIdentifier(identifier) ?? this.ensureMarket(params);
    }

    this.pending.add(identifier);
    try {
      return await this._spawn(params);
    } finally {
      this.pending.delete(identifier);
    }
  }

  private async _spawn(params: Parameters<typeof this.ensureMarket>[0]): Promise<db.MarketRow> {
    const { identifier, assetClass, source, displayName, imageUrl, sourceUrl, sourceMetadata } = params;

    log.info({ identifier, assetClass, source }, 'Spawning market...');

    // Generate mint keypair baru
    const mintKeypair = Keypair.generate();

    // Build + sign + send tx
    const tx = await buildCreateMarketTx({
      identifier,
      assetClass,
      mintKeypairPublicKey: mintKeypair.publicKey,
      oracleAuthority: signer.publicKey, // backend signer sebagai oracle authority
      baseVirtualSol: DEFAULT_BASE_VIRTUAL_SOL,
      virtualTokenSupply: DEFAULT_VIRTUAL_TOKEN_SUPPLY,
      elasticityBps: DEFAULT_ELASTICITY_BPS,
    });

    const sig = await sendAndConfirm(tx, [mintKeypair]);
    log.info({ identifier, sig }, 'Market spawned on-chain');

    // Derive PDAs
    const [market] = marketPda(identifier);

    // Simpan ke DB
    db.upsertMarket({
      pda: market.toBase58(),
      mint: mintKeypair.publicKey.toBase58(),
      identifier,
      asset_class: assetClass,
      display_name: displayName,
      image_url: imageUrl,
      source_url: sourceUrl,
      source_metadata_json: sourceMetadata ? JSON.stringify(sourceMetadata) : undefined,
      base_virtual_sol: Number(DEFAULT_BASE_VIRTUAL_SOL),
      virtual_token_supply: Number(DEFAULT_VIRTUAL_TOKEN_SUPPLY),
      real_sol_reserves: 0,
      tokens_minted: 0,
      creator_pubkey: signer.publicKey.toBase58(),
      creator_source: source,
      created_at: Date.now(),
      last_synced_slot: 0,
    });

    // Provision Auto hype watcher
    const row = db.getMarketByIdentifier(identifier)!;
    autoManager.createHypeWatcher(row).catch(e =>
      log.warn({ err: e, identifier }, 'Auto hype watcher provisioning failed')
    );

    return row;
  }
}

export const marketSpawner = new MarketSpawner();
```

### `src/services/oracle-updater.ts`

> **Catatan arsitektur:** `ratchet_multiplier_bps` dari oracle **tidak lagi mempengaruhi harga buy/sell**.
> Program sekarang menggunakan pure supply/demand AMM (`pool_sol = base_virtual_sol + real_sol_reserves`).
> Oracle updater tetap berjalan karena ratchet masih ditampilkan di UI sebagai mindshare indicator,
> dan nilai `ratchet_bps` masih di-emit di Trade event untuk keperluan analytics.

```typescript
import cron from 'node-cron';
import * as db from '../db';
import * as elfa from '../elfa/client';
import { buildUpdateMindshareTx, sendAndConfirm } from '../solana/instructions';
import { log } from '../utils/log';
import { config } from '../config';

const MIN_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 300 detik (sama dengan on-chain constraint)
const MINDSHARE_BPS_MAX = 100_000;

export class OracleUpdater {
  start() {
    cron.schedule('*/15 * * * *', () => {
      this.updateAll().catch(e => log.error({ err: e }, 'Oracle update all failed'));
    });
    log.info('OracleUpdater started (every 15 minutes)');
  }

  async updateAll() {
    const markets = db.getAllActiveMarkets();
    log.debug({ count: markets.length }, 'Updating oracles...');

    for (const market of markets) {
      try {
        await this.updateOne(market);
      } catch (e) {
        log.warn({ err: e, pda: market.pda }, 'Oracle update failed for market');
      }
    }
  }

  async updateOne(market: db.MarketRow) {
    // Cek interval minimum
    const last = db.getLastMindshareEntry(market.pda);
    if (last && Date.now() - last.recorded_at < MIN_UPDATE_INTERVAL_MS) {
      return; // Terlalu cepat, skip
    }

    const bps = await this.fetchMindshareBps(market);
    if (bps === 0) return;

    await this.submitMindshareUpdate(market.pda, market.identifier, bps);
  }

  async submitMindshareUpdate(marketPda: string, identifier: string, bps: number) {
    const tx = await buildUpdateMindshareTx({ identifier, newMindshareBps: bps });
    const sig = await sendAndConfirm(tx);

    db.appendMindshareHistory({
      market_pda: marketPda,
      current_bps: bps,
      source: 'rest_poll',
      tx_signature: sig,
      recorded_at: Date.now(),
    });

    // Re-read on-chain state dan update DB
    // (simplified: trust our calculation, sync di trade-indexer untuk presisi)
    log.info({ identifier, bps, sig }, 'Oracle updated');
  }

  async fetchMindshareBps(market: db.MarketRow): Promise<number> {
    // Untuk crypto (asset_class 0) dan dex (1): pakai trending-tokens cache
    if (market.asset_class < 2) {
      const cached = db.getLatestTrendingToken(market.identifier);
      if (cached && Date.now() - cached.fetched_at < 20 * 60 * 1000) {
        return elfa.pctToBps(cached.mindshare_pct ?? 0);
      }
      // Fallback: top-mentions
      try {
        const mentions = await elfa.getTopMentions(market.identifier, '1h');
        const total = mentions.reduce((s, m) => s + m.total_mentions, 0);
        return Math.min(total * 10, MINDSHARE_BPS_MAX);
      } catch {
        return 0;
      }
    }

    // Untuk equity/commodity/fx (2-4): pakai xyz: prefix top-mentions
    if (market.asset_class >= 2 && market.asset_class <= 4) {
      try {
        const mentions = await elfa.getTopMentions(market.identifier, '1h');
        const total = mentions.reduce((s, m) => s + m.total_mentions, 0);
        return Math.min(total * 5, MINDSHARE_BPS_MAX);
      } catch {
        return 0;
      }
    }

    // CA (asset_class 5): pakai trending-cas cache
    const lastX  = db.getLatestTrendingToken(market.identifier); // reuse structure
    const totalMentions = (lastX?.mention_count ?? 0);
    return Math.min(totalMentions * 10, MINDSHARE_BPS_MAX);
  }
}

export const oracleUpdater = new OracleUpdater();
```

### `src/services/metadata-enricher.ts`

```typescript
import * as db from '../db';
import { config } from '../config';
import { log } from '../utils/log';

export class MetadataEnricher {
  async fetch(contractAddress: string): Promise<db.TokenMetadataRow | null> {
    // Cache check
    const cached = db.getTokenMetadata(contractAddress);
    if (cached && Date.now() - cached.fetched_at < 24 * 60 * 60 * 1000) {
      return cached;
    }

    // 1. Helius DAS API
    try {
      const res = await fetch(`${config.SOLANA_RPC_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: '1', method: 'getAsset',
          params: { id: contractAddress },
        }),
      });
      const data: any = await res.json();
      if (data.result) {
        const meta: db.TokenMetadataRow = {
          contract_address: contractAddress,
          symbol: data.result.content?.metadata?.symbol,
          name: data.result.content?.metadata?.name,
          image_url: data.result.content?.links?.image,
          decimals: data.result.token_info?.decimals,
          source: 'helius_das',
          fetched_at: Date.now(),
        };
        db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) {
      log.debug({ err: e, contractAddress }, 'Helius DAS failed');
    }

    // 2. Jupiter token list (strict)
    try {
      const res = await fetch('https://token.jup.ag/strict', {
        signal: AbortSignal.timeout(10_000),
      });
      const tokens: any[] = await res.json();
      const found = tokens.find(t => t.address === contractAddress);
      if (found) {
        const meta: db.TokenMetadataRow = {
          contract_address: contractAddress,
          symbol: found.symbol,
          name: found.name,
          image_url: found.logoURI,
          decimals: found.decimals,
          source: 'jupiter',
          fetched_at: Date.now(),
        };
        db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) {
      log.debug({ err: e, contractAddress }, 'Jupiter fallback failed');
    }

    return null;
  }
}

export const metadataEnricher = new MetadataEnricher();
```

### `src/services/webhook-receiver.ts`

```typescript
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import * as db from '../db';
import { queue } from '../queue';
import { log } from '../utils/log';
import { config } from '../config';

function verifyAutoWebhook(
  secret: string,
  rawBody: string,
  signatureHeader: string,
  timestamp: string,
  eventId: string,
): boolean {
  if (!signatureHeader?.startsWith('v1=')) return false;
  const given = signatureHeader.slice(3);
  const signingKey = createHash('sha256').update(secret).digest();
  const payload = `${timestamp}.${eventId}.${rawBody}`;
  const expected = createHmac('sha256', signingKey).update(payload).digest('hex');
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export async function handleAutoWebhook(req: Request, res: Response) {
  const rawBody = (req as any).rawBody as string;
  const signature = req.headers['x-auto-signature'] as string;
  const timestamp = req.headers['x-auto-signature-timestamp'] as string;
  const eventId = req.headers['x-auto-event-id'] as string;

  if (!signature || !timestamp || !eventId) {
    return res.status(400).json({ error: 'Missing headers' });
  }

  // Replay attack: tolak request lebih dari 5 menit
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return res.status(401).json({ error: 'Timestamp expired' });
  }

  if (!verifyAutoWebhook(config.ELFA_AUTO_WEBHOOK_SECRET, rawBody, signature, timestamp, eventId)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Idempotency
  if (db.autoEventExists(eventId)) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  const payload = req.body;
  db.upsertAutoEvent({
    event_id: eventId,
    query_id: payload.queryId ?? '',
    channel: payload.channel ?? 'webhook',
    payload_json: JSON.stringify(payload),
    received_at: Date.now(),
  });

  queue.push('auto_event', { eventId, payload });

  return res.status(202).json({ ok: true });
}

// Helius webhook untuk indexing trades
export async function handleHeliusWebhook(req: Request, res: Response) {
  // Verify Helius signature
  const secret = config.HELIUS_WEBHOOK_SECRET;
  const authHeader = req.headers.authorization;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  const transactions: any[] = req.body;
  for (const txData of transactions) {
    try {
      if (!txData.instructions?.some((ix: any) => ix.programId === config.TREDIE_PROGRAM_ID)) continue;
      // TODO: decode Anchor event dari txData.events atau logs
      // Untuk MVP: simpan raw signature dan sync nanti
      log.debug({ sig: txData.signature }, 'Helius trade event received');
    } catch (e) {
      log.warn({ err: e }, 'Failed to process Helius webhook event');
    }
  }

  return res.status(200).end();
}
```

### `src/services/auto-manager.ts`

```typescript
import cron from 'node-cron';
import * as db from '../db';
import * as autoClient from '../elfa/auto-client';
import { config } from '../config';
import { log } from '../utils/log';

export async function createHypeWatcher(market: db.MarketRow): Promise<string | null> {
  // Skip jika asset class 5 (CA) dan identifier terlalu panjang untuk Elfa Auto
  if (market.asset_class === 5 && market.identifier.length > 20) {
    log.debug({ identifier: market.identifier }, 'Skipping Auto query for long CA identifier');
    return null;
  }

  const queryConfig = {
    title: `Tredie hype: ${market.identifier}`,
    conditions: {
      OR: [
        {
          AND: [
            {
              source: 'ta', method: 'rsi',
              args: { symbol: market.identifier, timeframe: '1h', period: 14 },
              operator: 'crosses_above', value: 70,
            },
            {
              source: 'price', method: 'change',
              args: { symbol: market.identifier, period: '1h' },
              operator: '>', value: 0.05,
            },
          ],
        },
        {
          source: 'llm', method: 'athena_condition',
          args: {
            query: `Has ${market.identifier} had a viral mention or smart-account buy call in the last 1h?`,
            period: '1h', speed: 'fast',
          },
          operator: '==', value: true,
        },
      ],
    },
    actions: [
      {
        stepId: 'step_1',
        type: 'webhook',
        params: {
          url: `${config.BACKEND_URL}/api/auto/events?market=${market.pda}&type=hype_event`,
        },
      },
    ],
    expiresIn: '7d',
  };

  try {
    const validated = await autoClient.validateQuery(queryConfig);
    if (!validated.valid) {
      log.warn({ errors: validated.errors, identifier: market.identifier }, 'Auto query validation failed');
      return null;
    }

    const created = await autoClient.createQuery(queryConfig);

    db.insertAutoQuery({
      query_id: created.queryId,
      query_type: 'hype_event',
      market_pda: market.pda,
      config_json: JSON.stringify(queryConfig),
      status: 'active',
      created_at: Date.now(),
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    log.info({ queryId: created.queryId, identifier: market.identifier }, 'Auto hype watcher created');
    return created.queryId;
  } catch (e) {
    log.warn({ err: e, identifier: market.identifier }, 'Failed to create Auto query');
    return null;
  }
}

export function startRotationCron() {
  // Daily: rotate queries yang mau expire
  cron.schedule('0 2 * * *', async () => {
    const expiring = db.getAutoQueriesExpiringSoon(24 * 60 * 60 * 1000);
    for (const q of expiring) {
      try {
        await autoClient.cancelQuery(q.query_id);
        const market = db.getMarketByPda(q.market_pda!);
        if (market) await createHypeWatcher(market);
      } catch (e) {
        log.warn({ err: e, queryId: q.query_id }, 'Query rotation failed');
      }
    }
  });
}
```

### `src/services/link-resolver.ts`

```typescript
import { log } from '../utils/log';
import * as db from '../db';

export interface LinkMetadata {
  platform: 'twitter' | 'tiktok' | 'youtube' | 'instagram' | 'unknown';
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  authorName?: string;
  embedHtml?: string;
}

export class LinkResolver {
  async resolve(url: string): Promise<LinkMetadata> {
    const cached = db.getLinkCache(url);
    if (cached && cached.expires_at > Date.now()) {
      return JSON.parse(cached.metadata_json) as LinkMetadata;
    }

    const platform = this.detectPlatform(url);
    let metadata: LinkMetadata = { platform: 'unknown' };

    try {
      switch (platform) {
        case 'twitter':  metadata = await this.resolveTwitter(url); break;
        case 'tiktok':   metadata = await this.resolveTikTok(url); break;
        case 'youtube':  metadata = await this.resolveYouTube(url); break;
        case 'instagram':metadata = await this.resolveOgMeta(url, 'instagram'); break;
      }
    } catch (e) {
      log.warn({ err: e, url }, 'Link resolution failed, using unknown metadata');
    }

    db.cacheLinkResolution(url, platform, metadata);
    return metadata;
  }

  private detectPlatform(url: string): LinkMetadata['platform'] {
    if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url)) return 'instagram';
    return 'unknown';
  }

  private async resolveTikTok(url: string): Promise<LinkMetadata> {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    const d: any = await res.json();
    return { platform: 'tiktok', title: d.title, thumbnailUrl: d.thumbnail_url, authorName: d.author_name, embedHtml: d.html };
  }

  private async resolveYouTube(url: string): Promise<LinkMetadata> {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    const d: any = await res.json();
    return { platform: 'youtube', title: d.title, thumbnailUrl: d.thumbnail_url, authorName: d.author_name, embedHtml: d.html };
  }

  private async resolveTwitter(url: string): Promise<LinkMetadata> {
    try {
      const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`);
      if (!res.ok) throw new Error('oEmbed failed');
      const d: any = await res.json();
      return { platform: 'twitter', authorName: d.author_name, embedHtml: d.html };
    } catch {
      return this.resolveOgMeta(url, 'twitter');
    }
  }

  private async resolveOgMeta(url: string, platform: LinkMetadata['platform']): Promise<LinkMetadata> {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Twitterbot/1.0' }, signal: AbortSignal.timeout(10_000) });
    const html = await res.text();
    return {
      platform,
      title: this.extractMeta(html, 'og:title'),
      description: this.extractMeta(html, 'og:description'),
      thumbnailUrl: this.extractMeta(html, 'og:image'),
    };
  }

  private extractMeta(html: string, prop: string): string | undefined {
    const match = html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
      ?? html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'));
    return match?.[1];
  }
}

export const linkResolver = new LinkResolver();
```

### `src/services/symbol-extractor.ts`

```typescript
import * as elfaClient from '../elfa/client';
import * as autoClient from '../elfa/auto-client';
import { metadataEnricher } from './metadata-enricher';
import type { LinkMetadata } from './link-resolver';
import { log } from '../utils/log';

export interface ExtractionResult {
  symbol: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export class SymbolExtractor {
  async extract(metadata: LinkMetadata): Promise<ExtractionResult> {
    const content = `${metadata.title ?? ''} ${metadata.description ?? ''} ${metadata.authorName ?? ''}`.slice(0, 2000);

    // Strategy A: $TICKER cashtag
    const cashtagMatch = content.match(/\$([A-Z]{2,10})\b/);
    if (cashtagMatch) {
      const symbol = cashtagMatch[1];
      const v = await autoClient.validateSymbol(symbol);
      if (v.supported) return { symbol, confidence: 'high' };
    }

    // Strategy B: Solana CA (base58, 32-44 chars)
    const caMatch = content.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
    if (caMatch) {
      const meta = await metadataEnricher.fetch(caMatch[1]);
      if (meta) return { symbol: caMatch[1], confidence: 'high' };
    }

    // Strategy C: HIP-3 xyz: symbols
    const upperWords = content.match(/\b([A-Z]{2,6})\b/g) ?? [];
    for (const word of upperWords.slice(0, 15)) {
      const prefixed = `xyz:${word}`;
      const v = await autoClient.validateSymbol(prefixed);
      if (v.supported) return { symbol: prefixed, confidence: 'medium' };
    }

    // Strategy D: Elfa Chat (AI extraction)
    try {
      const response = await elfaClient.elfaChat(
        `What single financial asset (crypto, equity, or commodity) is this content primarily about? ` +
        `Return ONLY the ticker symbol. Use xyz: prefix for equities/commodities. Return "none" if unclear. ` +
        `Content: ${content.slice(0, 500)}`,
        'fast',
      );
      const extracted = response.answer.trim().replace(/[^a-zA-Z0-9:]/g, '');
      if (extracted && extracted !== 'none') {
        const v = await autoClient.validateSymbol(extracted);
        if (v.supported) return { symbol: extracted, confidence: 'medium' };
      }
    } catch (e) {
      log.debug({ err: e }, 'Elfa Chat extraction failed');
    }

    return { symbol: null, confidence: 'low' };
  }
}

export const symbolExtractor = new SymbolExtractor();
```

---

## 10. API Routes

### `src/api/routes.ts`

```typescript
import type { Express } from 'express';
import * as marketsApi from './markets';
import * as trendingApi from './trending';
import * as searchApi from './search';
import * as resolveLinkApi from './resolve-link';
import * as healthApi from './health';
import { handleAutoWebhook, handleHeliusWebhook } from '../services/webhook-receiver';

export function registerRoutes(app: Express) {
  const v1 = '/api/v1';

  // Health
  app.get(`${v1}/health`, healthApi.getHealth);

  // Markets
  app.get(`${v1}/markets`, marketsApi.getMarkets);
  app.get(`${v1}/markets/:identifier`, marketsApi.getMarket);
  app.get(`${v1}/markets/:identifier/trades`, marketsApi.getMarketTrades);
  app.post(`${v1}/markets/prepare-trade`, marketsApi.prepareTrade);
  app.post(`${v1}/markets/prepare-create`, marketsApi.prepareCreate);

  // Trending
  app.get(`${v1}/trending/tokens`, trendingApi.getTrendingTokens);
  app.get(`${v1}/trending/cas/:platform`, trendingApi.getTrendingCAs);

  // Search
  app.get(`${v1}/search`, searchApi.search);

  // Link resolver
  app.post(`${v1}/resolve-link`, resolveLinkApi.resolveLink);

  // Webhooks
  app.post('/api/auto/events', handleAutoWebhook);
  app.post('/api/helius/events', handleHeliusWebhook);
}
```

### `src/api/markets.ts`

```typescript
import type { Request, Response } from 'express';
import * as db from '../db';
import { buildBuyTx, buildSellTx } from '../solana/instructions';
import { marketSpawner } from '../services/market-spawner';
import { PublicKey } from '@solana/web3.js';

export async function getMarkets(req: Request, res: Response) {
  const { assetClass, limit = '50', sortBy = 'mindshare', order = 'desc' } = req.query as Record<string, string>;

  let query = 'SELECT * FROM markets';
  const params: (string | number)[] = [];

  if (assetClass !== undefined && assetClass !== '') {
    query += ' WHERE asset_class = ?';
    params.push(Number(assetClass));
  }

  const sortCol = sortBy === 'volume' ? 'real_sol_reserves' : 'current_mindshare_bps';
  query += ` ORDER BY ${sortCol} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`;
  params.push(Math.min(Number(limit), 100));

  const markets = db.db.prepare(query).all(...params);
  const total = db.db.prepare('SELECT COUNT(*) as c FROM markets').get() as { c: number };

  res.json({ markets, total: total.c });
}

export async function getMarket(req: Request, res: Response) {
  const { identifier } = req.params;
  const market = db.getMarketByIdentifier(decodeURIComponent(identifier));
  if (!market) return res.status(404).json({ error: 'Market not found' });

  const mindshareHistory = db.getMindshareHistory(market.pda, 200);
  const recentTrades = db.getRecentTrades(market.pda, 50);

  res.json({ market, mindshareHistory, recentTrades });
}

export async function getMarketTrades(req: Request, res: Response) {
  const { identifier } = req.params;
  const { limit = '50' } = req.query as Record<string, string>;
  const market = db.getMarketByIdentifier(decodeURIComponent(identifier));
  if (!market) return res.status(404).json({ error: 'Market not found' });

  const trades = db.getRecentTrades(market.pda, Number(limit));
  res.json({ trades });
}

// Frontend kirim params, backend return serialized unsigned tx untuk di-sign user
export async function prepareTrade(req: Request, res: Response) {
  const { identifier, side, solAmount, tokenAmount, slippageBps = 100, trader } = req.body;

  const market = db.getMarketByIdentifier(identifier);
  if (!market) return res.status(404).json({ error: 'Market not found' });

  const traderPubkey = new PublicKey(trader);
  const mintPubkey = new PublicKey(market.mint);

  let tx;
  if (side === 'buy') {
    const solIn = BigInt(Math.floor(solAmount * 1e9));
    const minOut = BigInt(0); // TODO: calculate from slippage
    tx = await buildBuyTx({ buyer: traderPubkey, identifier, mintPubkey, solAmountIn: solIn, minTokensOut: minOut });
  } else {
    const tokensIn = BigInt(tokenAmount);
    const minSolOut = BigInt(0);
    tx = await buildSellTx({ seller: traderPubkey, identifier, mintPubkey, tokensIn, minSolOut });
  }

  // Serialize tanpa signature (user akan sign di frontend)
  const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
  res.json({ transaction: serialized });
}

// Backend prepare create_market tx jika market belum ada
export async function prepareCreate(req: Request, res: Response) {
  const { identifier, source, sourceMetadata } = req.body;
  const existing = db.getMarketByIdentifier(identifier);
  if (existing) {
    return res.json({ market: existing, alreadyExists: true });
  }

  try {
    const market = await marketSpawner.ensureMarket({
      identifier, assetClass: 0, source: source ?? 'user_search',
      sourceMetadata,
    });
    res.json({ market, alreadyExists: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
```

### `src/api/trending.ts`

```typescript
import type { Request, Response } from 'express';
import * as db from '../db';

export function getTrendingTokens(_req: Request, res: Response) {
  // Ambil trending terbaru (dalam 20 menit terakhir) dan join dengan market data
  const threshold = Date.now() - 20 * 60 * 1000;
  const rows = db.db.prepare(`
    SELECT tt.*, m.pda as market_pda, m.ratchet_multiplier_bps, m.real_sol_reserves
    FROM trending_tokens tt
    LEFT JOIN markets m ON m.identifier = tt.symbol
    WHERE tt.fetched_at > ?
    GROUP BY tt.symbol
    HAVING MAX(tt.fetched_at)
    ORDER BY tt.rank_position ASC
    LIMIT 50
  `).all(threshold);
  res.json({ tokens: rows });
}

export function getTrendingCAs(req: Request, res: Response) {
  const { platform } = req.params;
  if (!['twitter', 'telegram'].includes(platform)) {
    return res.status(400).json({ error: 'platform must be twitter or telegram' });
  }

  const threshold = Date.now() - 20 * 60 * 1000;
  const rows = db.db.prepare(`
    SELECT tc.*, tm.symbol, tm.name, tm.image_url,
           m.pda as market_pda, m.ratchet_multiplier_bps
    FROM trending_cas tc
    LEFT JOIN token_metadata tm ON tm.contract_address = tc.contract_address
    LEFT JOIN markets m ON m.identifier = tc.contract_address
    WHERE tc.source_platform = ? AND tc.fetched_at > ?
    GROUP BY tc.contract_address
    HAVING MAX(tc.fetched_at)
    ORDER BY tc.rank_position ASC
    LIMIT 50
  `).all(platform, threshold);
  res.json({ cas: rows });
}
```

### `src/api/search.ts`

```typescript
import type { Request, Response } from 'express';
import * as db from '../db';

export function search(req: Request, res: Response) {
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) return res.json({ suggestions: [] });

  const query = q.trim().toUpperCase();
  const isCA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.trim());

  if (isCA) {
    const meta = db.getTokenMetadata(q.trim());
    const market = db.getMarketByIdentifier(q.trim());
    return res.json({
      suggestions: [{
        type: 'ca',
        value: q.trim(),
        display: `${meta?.symbol ?? 'Unknown'} · ${q.trim().slice(0,6)}...${q.trim().slice(-4)}`,
        marketPda: market?.pda,
      }],
    });
  }

  const markets = db.db.prepare(`
    SELECT * FROM markets
    WHERE UPPER(identifier) LIKE ? OR UPPER(display_name) LIKE ?
    LIMIT 8
  `).all(`%${query}%`, `%${query}%`) as db.MarketRow[];

  const suggestions = markets.map(m => ({
    type: m.asset_class === 5 ? 'ca' : 'symbol',
    value: m.identifier,
    display: m.display_name ? `${m.identifier} · ${m.display_name}` : m.identifier,
    marketPda: m.pda,
    ratchetBps: m.ratchet_multiplier_bps,
  }));

  res.json({ suggestions });
}
```

### `src/api/resolve-link.ts`

```typescript
import type { Request, Response } from 'express';
import { linkResolver } from '../services/link-resolver';
import { symbolExtractor } from '../services/symbol-extractor';
import * as db from '../db';

export async function resolveLink(req: Request, res: Response) {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const metadata = await linkResolver.resolve(url);
  const { symbol, confidence } = await symbolExtractor.extract(metadata);

  let suggestedMarketPath: string | null = null;
  if (symbol) {
    const market = db.getMarketByIdentifier(symbol);
    suggestedMarketPath = market
      ? `/markets/${encodeURIComponent(symbol)}`
      : `/markets/${encodeURIComponent(symbol)}?create=true`;
  }

  // Update link cache dengan extracted symbol
  if (symbol) {
    db.cacheLinkResolution(url, metadata.platform, metadata, symbol);
  }

  res.json({ metadata, extractedSymbol: symbol, confidence, suggestedMarketPath });
}
```

### `src/api/health.ts`

```typescript
import type { Request, Response } from 'express';
import { connection } from '../solana/connection';
import { db } from '../db';

export async function getHealth(_req: Request, res: Response) {
  let slot = 0;
  try { slot = await connection.getSlot(); } catch {}

  const lastTrade = db.prepare('SELECT block_time FROM trades ORDER BY block_time DESC LIMIT 1').get() as any;

  res.json({
    ok: true,
    version: '1.0.0',
    slot,
    lastIndexedTrade: lastTrade?.block_time ?? null,
  });
}
```

---

## 11. Queue

### `src/queue/index.ts`

```typescript
// In-memory queue untuk development.
// Untuk production, ganti dengan BullMQ.
import { log } from '../utils/log';
import * as db from '../db';
import { oracleUpdater } from '../services/oracle-updater';
import { config } from '../config';

type JobType = 'auto_event';

interface Job {
  type: JobType;
  data: any;
}

class InMemoryQueue {
  private jobs: Job[] = [];
  private processing = false;

  push(type: JobType, data: any) {
    this.jobs.push({ type, data });
    if (!this.processing) this.processNext();
  }

  private async processNext() {
    if (this.jobs.length === 0) { this.processing = false; return; }
    this.processing = true;

    const job = this.jobs.shift()!;
    try {
      await this.handle(job);
      if (job.type === 'auto_event') {
        db.markAutoEventProcessed(job.data.eventId, 'success');
      }
    } catch (e) {
      log.error({ err: e, job }, 'Queue job failed');
      if (job.type === 'auto_event') {
        db.markAutoEventProcessed(job.data.eventId, 'failed');
      }
    }

    setTimeout(() => this.processNext(), 100);
  }

  private async handle(job: Job) {
    if (job.type === 'auto_event') {
      const { payload } = job.data;
      const dbQuery = db.getAutoQuery(payload.queryId);
      if (!dbQuery) return;

      if (dbQuery.query_type === 'hype_event' && dbQuery.market_pda) {
        const market = db.getMarketByPda(dbQuery.market_pda);
        if (!market) return;

        // Boost mindshare saat hype event
        const boosted = Math.min(
          market.peak_mindshare_bps + config.HYPE_EVENT_PREMIUM_BPS,
          100_000,
        );
        if (boosted > market.peak_mindshare_bps) {
          await oracleUpdater.submitMindshareUpdate(market.pda, market.identifier, boosted);
        }

        log.info({ identifier: market.identifier, boosted }, 'Hype event processed');
      }
    }
  }
}

export const queue = new InMemoryQueue();
```

---

## 12. Phase Build Order

### Phase 1 — Server + DB (hari 1)

```
□ bun init, install dependencies
□ tsconfig.json
□ src/config.ts dengan zod validation
□ src/db/migrations/001_initial.sql
□ src/db/index.ts dengan semua helper functions
□ bun run db:migrate
□ src/index.ts — Express server berjalan di port 4000
□ GET /api/v1/health merespons dengan ok: true
```

**Acceptance**: `curl localhost:4000/api/v1/health` → `{ ok: true }`

### Phase 2 — Solana + Oracle (hari 1)

```
□ src/solana/connection.ts
□ src/solana/signer.ts
□ src/solana/pda.ts
□ src/solana/instructions.ts (create_market + update_mindshare)
□ Tes manual: bun run scripts/spawn-market.ts --identifier BTC
□ Tes manual: bun run scripts/manual-oracle-update.ts --identifier BTC --bps 2500
□ Market BTC muncul di DB dan on-chain
```

**Acceptance**: Devnet explorer tunjukkan Market PDA dan Oracle PDA untuk BTC.

### Phase 3 — Elfa + Poller (hari 1-2)

```
□ src/elfa/types.ts
□ src/elfa/client.ts
□ src/elfa/auto-client.ts
□ src/services/trending-poller.ts
□ src/services/market-spawner.ts
□ src/services/oracle-updater.ts
□ src/services/metadata-enricher.ts
□ Integrasi ke src/index.ts: start poller + updater
□ Jalankan 30+ menit, verifikasi DB terisi
```

**Acceptance**: Minimal 5 markets di DB dengan mindshare data setelah 30 menit.

### Phase 4 — API Routes (hari 2)

```
□ Semua api/*.ts
□ src/api/routes.ts
□ Tes semua endpoint dengan curl atau Postman
□ GET /api/v1/markets → list markets
□ GET /api/v1/trending/tokens → trending data
□ GET /api/v1/trending/cas/twitter → CA data
□ GET /api/v1/search?q=BTC → suggestions
□ POST /api/v1/resolve-link → link metadata
□ POST /api/v1/markets/prepare-trade → unsigned tx
```

**Acceptance**: Semua endpoint merespons dengan data valid.

### Phase 5 — Webhook + Auto (hari 2-3)

```
□ src/queue/index.ts
□ src/services/webhook-receiver.ts
□ src/services/auto-manager.ts
□ src/services/event-processor.ts (via queue)
□ Expose endpoint /api/auto/events ke internet (ngrok untuk dev)
□ Register Elfa Auto webhook URL
□ Test: trigger manual hype event
```

**Acceptance**: Elfa Auto event diterima, HMAC verified, masuk queue, oracle terupdate.

### Phase 6 — Trade prepare (hari 3)

```
□ POST /api/v1/markets/prepare-trade full implementation
□ POST /api/v1/markets/prepare-create
□ Test integrasi dengan frontend signing flow
□ Verifikasi buy/sell tx on-chain
```

**Acceptance**: Frontend bisa request tx, sign dengan Privy, kirim, dan trade confirmed on-chain.

---

## 13. Scripts

### `src/scripts/seed-markets.ts`

```typescript
// bun run seed
// Pre-spawn 12 pasar utama untuk demo
import { marketSpawner } from '../services/market-spawner';
import { log } from '../utils/log';

const SEED_MARKETS = [
  // Crypto
  { identifier: 'BTC',     assetClass: 0 },
  { identifier: 'ETH',     assetClass: 0 },
  { identifier: 'SOL',     assetClass: 0 },
  { identifier: 'BONK',    assetClass: 0 },
  { identifier: 'WIF',     assetClass: 0 },
  { identifier: 'JUP',     assetClass: 0 },
  // Equity (HIP-3 xyz: prefix)
  { identifier: 'xyz:NVDA', assetClass: 2, displayName: 'Nvidia' },
  { identifier: 'xyz:TSLA', assetClass: 2, displayName: 'Tesla' },
  { identifier: 'xyz:AAPL', assetClass: 2, displayName: 'Apple' },
  // Commodity
  { identifier: 'xyz:XAU', assetClass: 3, displayName: 'Gold' },
  { identifier: 'xyz:CL',  assetClass: 3, displayName: 'Crude Oil' },
  // FX
  { identifier: 'xyz:DXY', assetClass: 4, displayName: 'US Dollar Index' },
];

async function seed() {
  for (const m of SEED_MARKETS) {
    try {
      log.info({ identifier: m.identifier }, 'Seeding market...');
      await marketSpawner.ensureMarket({
        ...m,
        source: 'auto_spawn',
        displayName: (m as any).displayName,
      });
      log.info({ identifier: m.identifier }, 'Market seeded');
      await new Promise(r => setTimeout(r, 2000)); // Rate limit
    } catch (e: any) {
      log.error({ err: e.message, identifier: m.identifier }, 'Seed failed');
    }
  }
  log.info('Seeding complete');
  process.exit(0);
}

seed();
```

### `src/scripts/manual-oracle-update.ts`

```typescript
// bun run oracle:update --identifier BTC --bps 2500
import { oracleUpdater } from '../services/oracle-updater';
import * as db from '../db';

const args = process.argv.slice(2);
const identifierIdx = args.indexOf('--identifier');
const bpsIdx = args.indexOf('--bps');
const identifier = args[identifierIdx + 1];
const bps = Number(args[bpsIdx + 1]);

if (!identifier || isNaN(bps)) {
  console.error('Usage: bun run oracle:update --identifier BTC --bps 2500');
  process.exit(1);
}

const market = db.getMarketByIdentifier(identifier);
if (!market) {
  console.error(`Market "${identifier}" not found in DB. Run seed first.`);
  process.exit(1);
}

oracleUpdater.submitMindshareUpdate(market.pda, identifier, bps)
  .then(sig => { console.log('Oracle updated:', sig); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
```

---

## 14. Error Handling & Logging

### `src/utils/log.ts`

```typescript
import pino from 'pino';
import { config } from '../config';

export const log = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

### `src/utils/hmac.ts`

```typescript
import { createHash, createHmac } from 'crypto';

export function sha256(data: string): Buffer {
  return createHash('sha256').update(data).digest();
}

export function hmacSha256(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}
```

### Global error handler di `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { log } from './utils/log';
import { registerRoutes } from './api/routes';
import { trendingPoller } from './services/trending-poller';
import { oracleUpdater } from './services/oracle-updater';
import { startRotationCron } from './services/auto-manager';
import './db'; // Initialize DB

const app = express();

// Middleware: simpan rawBody untuk HMAC verification
app.use((req, _res, next) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => { (req as any).rawBody = data; next(); });
});

app.use(express.json());
app.use(cors({ origin: config.FRONTEND_URL }));

registerRoutes(app);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.PORT, () => {
  log.info({ port: config.PORT, env: config.NODE_ENV }, 'Tredie backend started');

  // Start background services
  trendingPoller.start();
  oracleUpdater.start();
  startRotationCron();
});

export default app;
```

---

## Quick Start

```bash
# 1. Setup
cd backend
bun install

# 2. Environment
cp .env.example .env
# Edit .env dengan API keys

# 3. Database
bun run db:migrate

# 4. Seed markets awal
bun run seed

# 5. Development
bun run dev

# 6. Cek health
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/markets
curl http://localhost:4000/api/v1/trending/tokens
```

---

*Backend Tredie — semua service, route, dan database helper ada di dokumen ini.*
*Jika ada perubahan schema on-chain (identifierLen, asset_class, dll), sesuaikan `src/solana/instructions.ts`.*
