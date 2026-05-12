<div align="center">

<svg width="280" height="57" viewBox="0 0 3563 721" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.8853e-05 12.565C237.538 72.7035 447.069 -46.24 589.006 21.6685V157.838H381.719L348.219 720.013H149C149 720.013 125.5 278.338 315 157.838H8.8853e-05C8.83396e-05 157.606 -0.000110809 59.0581 8.8853e-05 12.565Z" fill="currentColor"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M996.762 21.6558C1071.39 21.6558 1125.54 28.0076 1159.2 40.7105C1193.18 53.0958 1220.33 75.326 1240.66 107.401C1260.98 139.476 1271.14 176.156 1271.14 217.44C1271.14 269.84 1255.74 313.189 1224.94 347.487C1194.13 381.467 1148.09 402.903 1086.79 411.795C1117.28 429.579 1142.37 449.11 1162.06 470.387C1182.07 491.665 1208.9 529.456 1242.56 583.761L1327.83 720H1159.2L1057.26 568.042C1021.06 513.736 996.285 479.597 982.947 465.624C969.609 451.333 955.477 441.647 940.551 436.566C925.625 431.167 901.966 428.467 869.573 428.467H840.992V720H699.989V21.6558H996.762ZM840.992 317H945.315C1012.96 317 1055.19 314.142 1072.03 308.425C1088.86 302.709 1102.04 292.863 1111.56 278.89C1121.09 264.917 1125.86 247.45 1125.86 226.491C1125.86 202.99 1119.5 184.095 1106.8 169.804C1094.42 155.196 1076.79 145.986 1053.92 142.175C1042.49 140.587 1008.19 139.793 951.031 139.793H840.992V317Z" fill="currentColor"/>
<path d="M1922.33 139.793H1545.53V294.611H1896.13V412.271H1545.53V602.339H1935.67V720H1404.53V21.6558H1922.33V139.793Z" fill="currentColor"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M2312.47 21.6558C2370.58 21.6558 2414.89 26.1016 2445.37 34.9937C2486.34 47.0615 2521.43 68.4987 2550.65 99.3032C2579.87 130.108 2602.1 167.899 2617.34 212.676C2632.58 257.136 2640.2 312.077 2640.2 377.497C2640.2 434.977 2633.06 484.519 2618.77 526.122C2601.3 576.933 2576.37 618.059 2543.98 649.499C2519.53 673.317 2486.5 691.895 2444.9 705.233C2413.77 715.078 2372.17 720 2320.09 720H2054.76V21.6558H2312.47ZM2195.76 602.339H2301.04C2340.41 602.339 2368.84 600.116 2386.3 595.67C2409.17 589.954 2428.07 580.267 2442.99 566.612C2458.23 552.956 2470.62 530.567 2480.15 499.445C2489.67 468.005 2494.44 425.291 2494.44 371.304C2494.44 317.317 2489.67 275.873 2480.15 246.974C2470.62 218.075 2457.28 195.528 2440.13 179.332C2422.98 163.135 2401.23 152.179 2374.87 146.462C2355.18 142.016 2316.6 139.793 2259.12 139.793H2195.76V602.339Z" fill="currentColor"/>
<path d="M2896.96 720H2755.96V21.6558H2896.96V720Z" fill="currentColor"/>
<path d="M3549.58 139.793H3172.77V294.611H3523.38V412.271H3172.77V602.339H3562.91V720H3031.77V21.6558H3549.58V139.793Z" fill="currentColor"/>
</svg>

### Trade What the World Is Talking About

**Live on Solana Devnet** · [tredie.fun](https://tredie.fun) · [Colosseum Frontier 2026](https://colosseum.org)

</div>

---

## The Problem

Financial markets react to attention — but they react slowly.

When something starts trending on X or Telegram, the price moves hours or days later, on exchanges that require listing approvals, KYC, and market makers. By the time a retail trader can act on a trend, the move is already over.

There is no market for the attention itself. There is no way to trade the signal, not just its downstream effect.

## The Solution

Tredie is an on-chain perpetual market protocol on Solana where markets open automatically when something trends — across crypto, equities, commodities, FX, and viral topics.

[Elfa AI](https://www.elfa.ai/) reads X and Telegram every 15 minutes. When social attention grows around an asset or topic, a market spawns on-chain within seconds. No listing process. No approval. No delay.

The first market on Tredie cleared **$200K in volume** before most people knew it existed.

---

## How It Works

### 1. Detection (Elfa AI)

[Elfa AI](https://www.elfa.ai/) monitors X (Twitter) and Telegram in real time. Every 2 hours, Tredie's backend polls three Elfa endpoints:

| Endpoint | Purpose |
|---|---|
| `/v2/aggregations/trending-tokens` | Trending crypto tickers by mention count |
| `/v2/aggregations/trending-cas/twitter` | Contract addresses trending on X |
| `/v2/aggregations/trending-cas/telegram` | Contract addresses trending on Telegram |
| `/v2/data/trending-narratives` | Macro topic themes |
| `/v2/data/top-mentions` | Per-asset mindshare % (oracle refresh) |

### 2. Auto-Spawn

When a candidate clears the mindshare threshold, the backend:

1. Validates the symbol (cashtag → HIP-3 → CA → Elfa Chat, 4-strategy pipeline)
2. Derives a PDA from the asset identifier (prevents duplicate race conditions)
3. Creates on-chain: `Market` + SPL `Mint` + `MindshareOracle` + `Vault` in a single tx
4. Market is live in **< 10 seconds** from detection

Any wallet can also trigger market creation manually via the frontend link-paste flow.

### 3. Bonding Curve (Anchor Program)

Tredie uses a constant-product AMM with identifier-based PDAs:

```
k = virtual_sol_reserves × virtual_token_supply
price = virtual_sol / virtual_token_supply
```

The `MindshareOracle` tracks attention growth on-chain. When Elfa AI reports mindshare growth, the oracle ratchets up — one way. Peak mindshare is never written down. This creates a verifiable on-chain attention history for every market.

### 4. Trading

Users connect with Privy (email login → embedded Solana wallet, or external wallet like Phantom). Buy and sell transactions are prepared by the backend, signed by the user's wallet, and confirmed on-chain. Protocol fee: **100 bps (1%)**.

---

## Asset Classes

| Class | Example Identifiers | Source |
|---|---|---|
| Crypto | `BTC`, `BONK`, `WIF` | Elfa trending-tokens |
| Equity | `xyz:AAPL`, `xyz:NVDA` | HIP-3 prefix + Elfa |
| Commodity | `xyz:XAU`, `xyz:CL` | HIP-3 prefix + Elfa |
| FX / Index | `xyz:DXY`, `xyz:EUR` | HIP-3 prefix + Elfa |
| Topics | `HANTA`, `MAGA`, `AI` | Elfa trending-narratives |

> **HIP-3 note:** Equities, commodities, FX, and indices always use the `xyz:` prefix. Without it, Elfa symbol validation fails.

---

## Program

**Network:** Solana Devnet

**Program ID:** `EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU`

### Accounts

| Account | PDA Seeds | Purpose |
|---|---|---|
| `MarketFactory` | `[b"factory"]` | Singleton registry; authority, fee config, market count |
| `Market` | `[b"market", identifier_bytes_44]` | Per-asset state; reserves, tokens minted, oracle ref |
| `MindshareOracle` | `[b"oracle", market.key()]` | On-chain attention history; current/peak mindshare bps, ratchet |
| `Vault` | `[b"vault", market.key()]` | SOL reserve custody account |

### Instructions

| Instruction | Who Can Call | Key Rules |
|---|---|---|
| `init_factory` | Deployer | One-time setup |
| `create_market` | Anyone | Identifier PDA prevents duplicates; `asset_class < 6` |
| `buy` | Any wallet | Constant product; 1% fee; slippage guard |
| `sell` | Token holder | Burns tokens; transfers SOL from vault minus fee |
| `update_mindshare` | Oracle authority | 300s cooldown; one-way peak ratchet |

### Constants

| Constant | Value |
|---|---|
| Default base virtual SOL | 30 SOL |
| Default virtual token supply | 1,000,000,000 × 10⁶ |
| Protocol fee | 100 bps (1%) |
| Max ratchet multiplier | 50,000 bps (5×) |
| Default elasticity | 5,000 bps |
| Min oracle update interval | 300 seconds |
| Identifier max length | 44 bytes |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Rust + Anchor 0.30+ |
| Contract tests | Bankrun / LiteSVM |
| Backend | Node.js + TypeScript + Express (Node 20+) |
| Database | SQLite / better-sqlite3 (dev) |
| Queue | BullMQ (Redis) prod · in-memory dev |
| Solana RPC | Helius devnet |
| Attention data | [Elfa AI](https://www.elfa.ai/) v2 REST + Auto webhooks |
| Frontend | Next.js 15 App Router + React 19 |
| Styling | Tailwind CSS 4.x |
| Charts | TradingView Lightweight Charts (OHLC) + Recharts (sparklines) |
| Wallet | Privy hybrid — embedded (email) + external (Phantom, Backpack) |
| State | Zustand + TanStack Query |
| Runtime | Bun everywhere |

---

## Backend Services

| Service | Cadence | Role |
|---|---|---|
| `trending-poller` | Every 2h | Polls 4 Elfa endpoints; feeds candidate queue |
| `market-spawner` | On-demand | Idempotent on-chain market creation |
| `oracle-updater` | Every 15min | Pushes mindshare bps on-chain for all active markets |
| `auto-manager` | Daily | Creates/rotates Elfa Auto hype watchers (7d TTL) |
| `webhook-receiver` | Real-time | HMAC-verified Elfa Auto webhook consumer |
| `event-processor` | Real-time | Routes hype events; logs mindshare history |
| `link-resolver` | On-demand | oEmbed + og: scraping for Twitter, TikTok, YouTube |
| `symbol-extractor` | On-demand | 4-strategy pipeline: cashtag → HIP-3 → CA → Elfa Chat |
| `trade-indexer` | Real-time | Helius webhook → decodes Anchor events → DB |

---

## API

Base URL: `http://localhost:4000/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/markets` | All markets; filter by `assetClass`, sort by `mindshare\|volume\|recent` |
| `GET` | `/markets/:identifier` | Market detail + mindshare history + recent trades |
| `GET` | `/trending/tokens` | Trending tokens with mindshare % and market PDA |
| `GET` | `/trending/cas/:platform` | CAs trending on `twitter` or `telegram` |
| `GET` | `/search?q=` | Typeahead suggestions |
| `POST` | `/resolve-link` | Paste a URL → extract symbol → suggest market |
| `POST` | `/markets/prepare-create` | Build create-market tx (unsigned) |
| `POST` | `/markets/prepare-trade` | Build buy/sell tx (unsigned) |
| `GET` | `/users/:pubkey/positions` | User holdings |

---

## Frontend Pages

| Route | Purpose |
|---|---|
| `/` → `/topics` | Default feed — trending markets sorted by mindshare |
| `/tokens` | Alternative feed — infinite scroll with asset class filter + social sub-tabs (Trending \| on X \| on TG) |
| `/tokens/[id]` | Market detail — OHLC chart, TradePanel, holders, recent trades |
| `/portfolio` | Holdings + PnL |
| `/my-trends` | Markets created by the connected wallet |

---

## Repository Structure

```
tredie/
├── programs/               # Anchor smart contract
│   ├── programs/tredie/src/
│   │   ├── lib.rs
│   │   ├── constants.rs
│   │   ├── errors.rs
│   │   ├── state/          # market.rs · oracle.rs · factory.rs
│   │   └── instructions/   # buy · sell · create_market · update_mindshare
│   └── tests/tredie.ts
├── backend/src/
│   ├── services/           # All polling, spawning, oracle, webhook services
│   ├── api/                # Express route handlers
│   ├── elfa/               # Elfa AI client + query types
│   ├── solana/             # RPC connection, signer, program client
│   └── db/                 # SQLite migrations
├── frontend/src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # UI components (header, market, wallet, ui)
│   ├── modules/            # Feature modules (portfolio, topics, tokens)
│   └── lib/ · store/       # Hooks, Zustand stores
└── landing-page/           # Marketing site (tredie.fun)
```

---

## Quick Start

```bash
# 1. Build and deploy the Anchor program
cd programs
anchor build
anchor deploy --provider.cluster devnet

# 2. Start the backend
cd backend
bun install
cp .env.example .env   # fill in HELIUS_API_KEY, ELFA_API_KEY, SIGNER_PRIVATE_KEY
bun run dev

# 3. Start the frontend
cd frontend
bun install
cp .env.example .env.local   # fill in NEXT_PUBLIC_* vars
bun run dev

# 4. Start the landing page
cd landing-page
bun install
bun run dev
```

### Environment Variables

**Backend** (`backend/.env`):
```
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
TREDIE_PROGRAM_ID=EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU
SIGNER_PRIVATE_KEY=...
HELIUS_API_KEY=...
ELFA_API_KEY=...
ELFA_API_SECRET=...
DATABASE_URL=./data/tredie.sqlite
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_TREDIE_PROGRAM_ID=EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_NETWORK=devnet
```

---

## Powered By

- [Elfa AI](https://www.elfa.ai/) — real-time social attention data across X and Telegram
- [Helius](https://helius.dev/) — Solana RPC, webhooks, and DAS API
- [Privy](https://privy.io/) — hybrid wallet infrastructure
- [Solana](https://solana.com/) — devnet

---

<div align="center">
  <sub>Built for <a href="https://colosseum.org">Colosseum Frontier 2026</a></sub>
</div>
