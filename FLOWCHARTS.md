# Tredie — Flowcharts

Format: **Mermaid** (draw.io import native).

**Cara import ke draw.io:**
1. Buka draw.io → New Diagram → Blank
2. Menu **Extras → Edit Diagram...** → pilih format **Mermaid** → paste blok yang lo mau
3. Atau: **Arrange tab → "+" Insert → Advanced → Mermaid** → paste

Tiap section di bawah berdiri sendiri — paste blok Mermaid (yang ada di antara ` ```mermaid ` dan ` ``` `) satu-satu.

---

## 1. System Architecture (High-Level)

Komponen utama, integrasi eksternal, dan arah data.

```mermaid
flowchart LR
    subgraph external[External Services]
        Elfa[Elfa AI<br/>social signal API]
        Helius[Helius RPC<br/>+ webhook]
        Solana[Solana devnet<br/>EUAyjsba...]
        Gemini[Gemini 2.5 Flash<br/>AI judge]
        MPL[MPL Token Metadata<br/>metaqbxx...]
    end

    subgraph backend[Tredie Backend - Hono on Bun]
        API[REST API /api/v1]
        Poller[Trending Poller<br/>cron 15min]
        AI[Gemini Judge]
        Spawner[Market Spawner]
        Oracle[Oracle Updater<br/>cron 15min]
        Hype[Local Hype Detector<br/>cron 15min, offset 7m]
        AutoMgr[Auto Manager<br/>HTTPS only]
        Trade[Trade Indexer]
    end

    DB[(Supabase Postgres<br/>+ Realtime)]
    Front[Next.js Frontend]

    Elfa -->|trends/tokens/CAs| Poller
    Poller --> AI
    AI -->|verdict| Poller
    Poller --> Spawner
    Spawner -->|create_market + MPL CPI| Solana
    Spawner --> DB
    Spawner -.->|metadata CPI| MPL
    Oracle -->|update_mindshare tx| Solana
    Hype -->|update_mindshare boost| Solana
    Solana -->|tx events| Helius
    Helius -->|webhook| Trade
    Trade --> DB
    AutoMgr -->|register query| Elfa
    Elfa -->|hype event webhook| API
    API --> DB
    AI -.->|generateContent| Gemini
    DB <-->|Realtime channels| Front
    Front -->|REST| API
```

---

## 2. Data Model (ER)

Tabel utama dan relasinya.

```mermaid
erDiagram
    markets ||--o{ trades : has
    markets ||--o{ mindshare_history : has
    markets ||--o{ auto_queries : may_have
    markets ||--o{ market_candidates : spawned_from
    auto_queries ||--o{ auto_events : receives

    markets {
        bigint id PK
        text pda UK
        text mint UK
        text identifier UK
        smallint asset_class
        text display_name
        bigint base_virtual_sol
        bigint virtual_token_supply
        bigint real_sol_reserves
        bigint tokens_minted
        int current_mindshare_bps
        int peak_mindshare_bps
        int ratchet_multiplier_bps
        text creator_pubkey
        text creator_source
        bigint created_at
    }

    trades {
        bigint id PK
        text signature UK
        text market_pda FK
        smallint side
        text trader
        bigint sol_amount
        bigint token_amount
        int ratchet_bps
        bigint block_time
        bigint slot
    }

    mindshare_history {
        bigint id PK
        text market_pda FK
        int current_bps
        int peak_bps
        int ratchet_bps
        text source
        bigint recorded_at
        text tx_signature
    }

    market_candidates {
        bigint id PK
        text source_kind
        text source_key
        jsonb raw_input
        text verdict
        text ai_identifier
        text ai_display_name
        smallint ai_asset_class
        int ai_confidence_bps
        text ai_reason
        text ai_model
        text merged_with
        text spawn_market_pda FK
        bigint created_at
        bigint decided_at
    }

    auto_queries {
        bigint id PK
        text query_id UK
        text query_type
        text market_pda FK
        jsonb config
        text status
        bigint created_at
        bigint expires_at
        text error_reason
    }

    auto_events {
        bigint id PK
        text event_id UK
        text query_id
        jsonb payload
        bigint received_at
        bigint processed_at
        text outcome
    }

    trending_tokens {
        bigint id PK
        text symbol
        int mention_count
        double mindshare_pct
        int rank_position
        bigint fetched_at
    }

    trending_cas {
        bigint id PK
        text contract_address
        text source_platform
        int mention_count
        bigint fetched_at
    }

    token_metadata {
        text contract_address PK
        text symbol
        text name
        text image_url
    }
```

---

## 3. Business Logic — Market Lifecycle

State machine untuk satu market dari kandidat sampai active trading.

```mermaid
stateDiagram-v2
    [*] --> Candidate: Elfa polling cycle /<br/>user search /<br/>link paste

    Candidate --> AIJudge: AI_GATING_ENABLED<br/>+ GEMINI_API_KEY set
    Candidate --> RuleSpawn: AI disabled /<br/>Gemini fallback

    AIJudge --> Spawn: verdict=spawn<br/>conf>=4000bps<br/>identifier valid
    AIJudge --> Skip: verdict=skip /<br/>low confidence /<br/>invalid identifier
    AIJudge --> Merge: verdict=merge /<br/>existing market match

    RuleSpawn --> Spawn: mention threshold passed
    RuleSpawn --> Skip: below threshold

    Skip --> [*]: logged in market_candidates
    Merge --> [*]: linked to existing pda

    Spawn --> OnChain: create_market ix<br/>+ MPL metadata CPI
    OnChain --> Active: confirmed

    Active --> Active: oracle update<br/>(15-min cron)
    Active --> HypeBoost: surge detected<br/>(local-hype-detector)
    HypeBoost --> Active: peak_mindshare_bps boosted<br/>+ ratchet bumped

    Active --> TradeUpdate: buy/sell tx indexed
    TradeUpdate --> Active: real_sol_reserves /<br/>tokens_minted updated

    Active --> [*]: protocol pause /<br/>delisted (manual)
```

---

## 4. Spawn Pipeline (with AI Gating)

Detail flow dari Elfa polling sampai market ter-spawn on-chain.

```mermaid
flowchart TD
    Start([Cron: TRENDING_POLL_CRON env<br/>default 2h<br/>or POST /admin/poll-trending])

    Start --> ParColl[Promise.allSettled - parallel collect]

    ParColl --> CN[collectNarratives]
    ParColl --> CT[collectTokens]
    ParColl --> CCA1[collectCAs twitter]
    ParColl --> CCA2[collectCAs telegram]

    CN --> Persist1[upsert raw to elfa_trend_cache]
    CT --> Persist2[upsert trending_tokens]
    CCA1 --> Persist3[upsert trending_cas<br/>filter Solana CAs >32B]
    CCA2 --> Persist3

    CN --> Aggregate[Aggregate candidate list]
    CT --> Aggregate
    CCA1 --> Aggregate
    CCA2 --> Aggregate

    Aggregate --> Dedup{recent decision<br/>in market_candidates<br/>within 1h?}
    Dedup -->|Yes| SkipDedup[Skip - cached]
    Dedup -->|No| Fresh[Fresh candidate]

    Fresh --> Gate{AI_GATING_ENABLED<br/>+ GEMINI_API_KEY?}

    Gate -->|No| Legacy[legacySpawn:<br/>rule-based threshold]
    Gate -->|Yes| Judge[judgeCandidates batch]

    Judge --> Gemini[POST Gemini API<br/>1 batched call<br/>responseSchema enforced]
    Gemini --> Decisions{AI returned<br/>decisions?}

    Decisions -->|null/error| Legacy
    Decisions -->|valid| Loop[For each decision]

    Loop --> V{verdict?}

    V -->|skip| LogSkip[Insert candidate<br/>verdict=skip]
    V -->|merge| LogMerge[Insert candidate<br/>verdict=merge<br/>merged_with=ident]
    V -->|spawn| Conf{confidence<br/>>= 4000 bps?}

    Conf -->|No| LogLow[Insert candidate<br/>verdict=skip<br/>reason=low_confidence]
    Conf -->|Yes| Valid{validateIdentifier<br/>10-byte cap +<br/>format regex?}

    Valid -->|No| LogInv[Insert candidate<br/>verdict=skip<br/>reason=invalid_identifier]
    Valid -->|Yes| Exist{market with<br/>identifier exists?}

    Exist -->|Yes| LogExist[verdict=merge<br/>spawn_market_pda set]
    Exist -->|No| InsertCand[Insert candidate<br/>verdict=spawn]

    InsertCand --> Spawn[marketSpawner.ensureMarket]

    Spawn --> Tx[buildCreateMarketTx<br/>+ Borsh name/uri<br/>+ MPL metadata PDA]
    Tx --> SendTx[sendAndConfirm to Solana]
    SendTx --> Success{tx confirmed?}

    Success -->|Yes| UpdateOK[updateCandidateVerdict<br/>spawn + spawn_market_pda]
    Success -->|No| UpdateFail[updateCandidateVerdict<br/>spawn_failed]

    UpdateOK --> WatchHype[auto-manager.createHypeWatcher]
    WatchHype --> HttpsCheck{BACKEND_URL<br/>HTTPS?}
    HttpsCheck -->|Yes| RegisterAuto[Elfa Auto subscription]
    HttpsCheck -->|No| SkipAuto[Skip - local-hype-detector handles]
```

---

## 5. AI Verdict Outcomes (Case Flows)

Apa yang terjadi per verdict + edge cases.

```mermaid
flowchart TD
    Input[Candidate fed to Gemini judge]
    Input --> AI[Batched Gemini call]
    AI --> Out{verdict?}

    Out -->|spawn| Path1[Path 1: SPAWN]
    Out -->|skip| Path3[Path 2: SKIP]
    Out -->|merge| Path4[Path 3: MERGE]

    Path1 --> Conf{confidence>=4000?}
    Conf -->|No| LowConf[Demoted to skip<br/>reason=low_confidence]
    Conf -->|Yes| Validate{validateIdentifier<br/>passes?}

    Validate -->|No| Invalid[Demoted to skip<br/>reason=invalid_identifier]
    Validate -->|Yes| ExistsCheck{exists in DB?}

    ExistsCheck -->|Yes| MergeExisting[Demoted to merge<br/>spawn_market_pda set]
    ExistsCheck -->|No| OnChain[create_market on-chain]

    OnChain --> TxResult{tx confirmed?}
    TxResult -->|Yes| FinalSpawn[verdict=spawn<br/>spawn_market_pda set]
    TxResult -->|No| FinalFail[verdict=spawn_failed]

    LowConf --> FinalSkipLow[market_candidates<br/>verdict=skip]
    Invalid --> FinalSkipInv[market_candidates<br/>verdict=skip]
    MergeExisting --> FinalMergeExisting[market_candidates<br/>verdict=merge]

    Path3 --> FinalSkip[market_candidates<br/>verdict=skip<br/>reason=ai_skip]
    Path4 --> FinalMerge[market_candidates<br/>verdict=merge<br/>merged_with set]

    AdminApprove[POST /admin/candidates/:id/approve]
    AdminApprove --> Override[Bypass AI verdict]
    Override --> ExistsCheck2{exists?}
    ExistsCheck2 -->|Yes| AlreadyExists[verdict=manual_approve<br/>already exists]
    ExistsCheck2 -->|No| OnChain2[create_market]
    OnChain2 --> FinalManual[verdict=manual_approve<br/>spawn_market_pda set]

    AdminReject[POST /admin/candidates/:id/reject]
    AdminReject --> FinalReject[verdict=manual_reject]
```

---

## 6. User Flow A — Search & Spawn (BYPASS AI)

User cari ticker / paste identifier → langsung spawn tanpa AI gating.

```mermaid
flowchart TD
    A1[User types BTC in search bar]
    A2[GET /api/v1/search?q=BTC]
    A3{Match in DB?}
    A4[Show suggestion + market preview]
    A5[User clicks Create Market]
    A6[POST /api/v1/markets/prepare-create<br/>identifier, assetClass, source=user_search]
    A7[marketSpawner.ensureMarket<br/>BYPASS AI judge]
    A8{exists?}
    A9[Sync from chain or DB cache]
    A10[buildCreateMarketTx + MPL CPI]
    A11[sendAndConfirm]
    A12[upsertMarket + auto-manager.createHypeWatcher]
    A13[Return market PDA + mint to frontend]
    A14[Frontend redirect to /m/BTC]

    A1 --> A2 --> A3
    A3 -->|Yes| A4 --> A5
    A3 -->|No empty| A5
    A5 --> A6 --> A7 --> A8
    A8 -->|Yes| A9 --> A13
    A8 -->|No| A10 --> A11 --> A12 --> A13
    A13 --> A14
```

---

## 7. User Flow B — Trade (Buy / Sell)

User beli/jual attention token via wallet signature.

```mermaid
flowchart TD
    B1[User opens market /m/PEPE]
    B2[GET /api/v1/markets/PEPE]
    B3[Frontend renders OHLC + mindshare history]
    B4{Buy or Sell?}
    B5[User: Buy 0.1 SOL slippage 1pct]
    B6[POST /api/v1/markets/prepare-trade<br/>identifier, side=buy, solAmount=0.1]
    B7[Backend buildBuyTx<br/>+ ATA precreate]
    B8[Return base64 unsigned tx]
    B9[Wallet signs in browser]
    B10[Frontend submits to Solana RPC]
    B11[Solana confirms tx<br/>emit Trade event in logs]
    B12[Helius webhook fires<br/>POST /api/webhooks/helius]
    B13[trade-indexer decodes Trade event<br/>side, sol_amount, token_amount, ratchet_bps]
    B14[insertTrade + syncMarketStateFromTrade]
    B15[Supabase Realtime channel pushes UPDATE]
    B16[Frontend live-updates price + balance]

    B1 --> B2 --> B3 --> B4
    B4 -->|Buy| B5
    B4 -->|Sell| B5b[POST prepare-trade<br/>side=sell, tokenAmount]
    B5 --> B6 --> B7 --> B8 --> B9 --> B10 --> B11
    B5b --> B6
    B11 --> B12 --> B13 --> B14 --> B15 --> B16
```

---

## 8. User Flow C — Paste Link

User paste URL → backend resolve metadata → suggest identifier → user confirm.

```mermaid
flowchart TD
    C1[User pastes Tweet/TG/site URL]
    C2[POST /api/v1/resolve-link<br/>url]
    C3{URL in link_cache<br/>not expired?}
    C4[Return cached resolution]
    C5[Detect platform - twitter/tg/web]
    C6[Fetch metadata + run symbol-extractor]
    C7[Cache result in link_cache TTL 24h]
    C8[Return suggestion:<br/>identifier candidate, displayName, imageUrl]
    C9[Frontend shows preview]
    C10[User confirms]
    C11[POST /api/v1/markets/prepare-create<br/>source=user_link_paste]
    C12[marketSpawner.ensureMarket BYPASS AI]
    C13[Spawn or sync existing]

    C1 --> C2 --> C3
    C3 -->|Yes| C4 --> C8
    C3 -->|No| C5 --> C6 --> C7 --> C8
    C8 --> C9 --> C10 --> C11 --> C12 --> C13
```

---

## 9. Service — Oracle Updater

Cron 15-min: pull mindshare dari Elfa keyword-mentions → push ke on-chain oracle.

```mermaid
flowchart TD
    O1([cron: every 15 min])
    O1 --> O2{globalThis<br/>__tredieOracleUpdaterRunning<br/>locked?}
    O2 -->|Yes| O3[Skip - already running -<br/>survives bun --hot reload]
    O2 -->|No| O4[Acquire lock]

    O4 --> O5[db.getAllActiveMarkets]
    O5 --> O6[For each market]

    O6 --> O7[Stagger 250ms<br/>avoid RPC burst]
    O7 --> O8{asset_class?}
    O8 -->|0-4 tradable| O9[Fetch Elfa keyword-mentions]
    O8 -->|5 CA| O10[Skip CA mindshare flow]
    O8 -->|6 trend| O11[Use existing peak<br/>local-hype-detector handles]

    O9 --> O12[Compute new bps from mention volume]
    O11 --> O13{decode oracle on-chain<br/>last_update + min_interval<br/>>= now?}
    O12 --> O13

    O13 -->|No - too recent| O14[Skip this market]
    O13 -->|Yes| O15[buildUpdateMindshareTx]

    O15 --> O16[sendAndConfirm]
    O16 --> O17{tx ok?}
    O17 -->|Yes| O18[appendMindshareHistory<br/>source=rest_poll<br/>tx_signature set]
    O17 -->|No 0x1773 etc| O19[Log warning<br/>continue next market]

    O18 --> O20[updateMarketMindshare in DB]
    O20 --> O6
    O14 --> O6
    O19 --> O6
    O10 --> O6

    O6 --> O21[Release lock]
    O21 --> O22[Log summary:<br/>updated, skipped, failed counts]
```

---

## 10. Service — Local Hype Detector

Self-hosted condition engine (Elfa Auto failed di free tier). Cron 15-min offset 7m dari oracle-updater.

```mermaid
flowchart TD
    H1([cron: every 15 min, offset 7m])
    H1 --> H2[db.getAllActiveMarkets<br/>filter asset_class=6 trends]
    H2 --> H3[For each trend market]

    H3 --> H4[getMindshareHistory limit 2]
    H4 --> H5{has both<br/>current + previous?}
    H5 -->|No - too new| H6[Skip - need baseline]
    H5 -->|Yes| H7[Read current_bps + previous_bps]

    H7 --> H8{ratio = current/previous<br/>>= SURGE_RATIO 1.5?}
    H8 -->|No| H9[No surge, continue]
    H8 -->|Yes| H10{delta = current - previous<br/>>= ABSOLUTE_DELTA_BPS 200?}

    H10 -->|No| H9
    H10 -->|Yes| H11{previous_bps<br/>>= MIN_PREV_BPS 50?}

    H11 -->|No| H9
    H11 -->|Yes| H12[Compute boostBps =<br/>peak_bps + HYPE_EVENT_PREMIUM_BPS]

    H12 --> H13[buildUpdateMindshareTx<br/>with boostBps]
    H13 --> H14[sendAndConfirm]
    H14 --> H15[appendMindshareHistory<br/>source=auto_event<br/>tx_signature set]
    H15 --> H16[Updates frontend annotations<br/>via Realtime]

    H6 --> H3
    H9 --> H3
    H16 --> H3
    H3 --> H17[Done]

    AdminTrigger([POST /admin/force-hype<br/>identifier, bps?])
    AdminTrigger --> ForceFire[forceFire bypasses thresholds<br/>injects synthetic surge]
    ForceFire --> H12
```

---

## 11. Service — Trade Indexer (Helius Webhook)

Solana tx confirmed → Helius push → decode Trade event log → upsert ke DB.

```mermaid
flowchart TD
    T1[Solana tx confirmed<br/>buy/sell instruction]
    T2[Helius posts to /api/webhooks/helius]
    T3{Authorization Bearer<br/>== HELIUS_WEBHOOK_SECRET?}
    T4[401 Unauthorized]
    T5[Parse tx array body]
    T6[For each tx]

    T7{has signature<br/>signature OR transaction.signatures[0]?}
    T8[Skip - log warning]

    T9[Inspect meta.logMessages]
    T10{Anchor Trade event<br/>discriminator detected?}
    T11[Skip - not a Trade]

    T12[Decode Trade event:<br/>side, sol_amount, token_amount,<br/>ratchet_bps, market, trader]
    T13[insertTrade ON CONFLICT DO NOTHING]
    T14[syncMarketStateFromTrade<br/>real_sol_reserves, tokens_minted, slot]

    T15[Realtime publication pushes<br/>INSERT to supabase_realtime]
    T16[Frontend subscribed to channel<br/>updates UI live]

    T1 --> T2 --> T3
    T3 -->|No| T4
    T3 -->|Yes| T5 --> T6 --> T7
    T7 -->|No| T8 --> T6
    T7 -->|Yes| T9 --> T10
    T10 -->|No| T11 --> T6
    T10 -->|Yes| T12 --> T13 --> T14 --> T15 --> T16
```

---

## 12. Service — Auto Manager + Elfa Auto Webhook

Hype watcher subscription (HTTPS only) + inbound webhook handler.

```mermaid
flowchart TD
    subgraph register[Register Phase - on market spawn]
        R1[New market spawned]
        R2[auto-manager.createHypeWatcher]
        R3{BACKEND_URL<br/>HTTPS?}
        R4[Skip - log debug<br/>local-hype-detector covers dev]
        R5{asset_class=5<br/>+ identifier > 20 chars?}
        R6[Skip - Auto symbol cap]
        R7[buildConditions per class<br/>tradable: TA + LLM<br/>trend: LLM only]
        R8[autoClient.validateQuery]
        R9{valid?}
        R10[insertFailedAutoQuery<br/>error_reason]
        R11[autoClient.createQuery]
        R12[insertAutoQuery<br/>status=active expires_at]

        R1 --> R2 --> R3
        R3 -->|No HTTP| R4
        R3 -->|Yes HTTPS| R5
        R5 -->|Yes| R6
        R5 -->|No| R7 --> R8 --> R9
        R9 -->|No| R10
        R9 -->|Yes| R11 --> R12
    end

    subgraph webhook[Webhook Phase - hype event fires]
        W1[Elfa Auto trigger fires]
        W2[POST /api/webhooks/elfa]
        W3{HMAC-SHA256<br/>SHA256 secret . ts.eventId.body<br/>= X-Auto-Signature v1=hex?}
        W4[401 invalid signature]
        W5{ts within 30s<br/>replay window?}
        W6[401 stale]
        W7{X-Auto-Event-Id<br/>already in auto_events?}
        W8[200 duplicate]
        W9[insertAutoEvent + 202]
        W10[Background: lookup market by query_id]
        W11[Compute boostBps<br/>peak + HYPE_EVENT_PREMIUM_BPS]
        W12[buildUpdateMindshareTx]
        W13[sendAndConfirm]
        W14[markAutoEventProcessed<br/>+ appendMindshareHistory<br/>source=auto_event]

        W1 --> W2 --> W3
        W3 -->|No| W4
        W3 -->|Yes| W5
        W5 -->|No| W6
        W5 -->|Yes| W7
        W7 -->|Yes| W8
        W7 -->|No| W9 --> W10 --> W11 --> W12 --> W13 --> W14
    end

    subgraph rotate[Rotation Phase - daily 02:00 UTC]
        Rot1[cron: 0 2 * * *]
        Rot2[getAutoQueriesExpiringSoon<br/>within 24h]
        Rot3[For each]
        Rot4[autoClient.cancelQuery]
        Rot5[Re-run createHypeWatcher<br/>fresh 7d expiry]

        Rot1 --> Rot2 --> Rot3 --> Rot4 --> Rot5
    end
```

---

## 13. Cron Schedule (Reference Card)

| Service | Schedule | Configurable? | Purpose |
|---------|----------|---------------|---------|
| Trending Poller | `TRENDING_POLL_CRON` env, default `0 */2 * * *` (every 2h) | ✅ env-tunable | Elfa polling + AI gating + spawn |
| Oracle Updater | `*/15 * * * *` | hardcoded | Push mindshare to on-chain oracle |
| Local Hype Detector | `7,22,37,52 * * * *` | hardcoded | Detect surges, boost peak on-chain |
| Auto Rotation | `0 2 * * *` (daily 02:00) | hardcoded | Recreate expiring Auto subscriptions |

The TrendingPoller default is throttled to 2h to fit inside the Gemini free
tier (20 requests/day). Bump to `*/15 * * * *` if running a paid Gemini plan.

```mermaid
flowchart LR
    H0[":00 (every 2h: poller)"] --> H7[":07 (hype)"] --> H15[":15 (oracle)"] --> H22[":22 (hype)"] --> H30[":30 (oracle)"] --> H37[":37 (hype)"] --> H45[":45 (oracle)"] --> H52[":52 (hype)"]
    H0 -.fires.-> Pol[TrendingPoller + OracleUpdater]
    H15 -.fires.-> Or[OracleUpdater only]
    H7 -.fires.-> Hy[LocalHypeDetector]
```

---

## 14. create_market Instruction Anatomy

Detail layout TX yang dikirim backend ke Solana program (post MPL CPI).

```mermaid
flowchart TD
    Ix["create_market instruction<br/>discriminator: sha256(global:create_market)[0..8]"]
    Ix --> Args[Arguments - Borsh:<br/>identifier u8;32<br/>identifier_len u8<br/>asset_class u8<br/>base_virtual_sol u64<br/>virtual_token_supply u64<br/>elasticity_bps u32<br/>name String<br/>uri String]

    Ix --> Accs[Accounts - 11 keys ordered:]

    Accs --> A0["[0] factory PDA<br/>writable"]
    Accs --> A1["[1] market PDA<br/>writable - init"]
    Accs --> A2["[2] mint Keypair<br/>signer + writable - init"]
    Accs --> A3["[3] oracle PDA<br/>writable - init"]
    Accs --> A4["[4] creator backend signer<br/>signer + writable - payer"]
    Accs --> A5["[5] oracle_authority<br/>readonly"]
    Accs --> A6["[6] metadata PDA<br/>writable - init via CPI"]
    Accs --> A7["[7] MPL Token Metadata Program"]
    Accs --> A8["[8] SPL Token Program"]
    Accs --> A9["[9] System Program"]
    Accs --> A10["[10] Rent Sysvar"]

    A1 --> Sub1[Inside program:<br/>seeds = market, identifier:32]
    A6 --> Sub2[Inside program:<br/>seeds = metadata, MPL, mint]
    A6 --> Sub3[Inside program:<br/>raw CPI to MPL<br/>CreateMetadataAccountsV3<br/>discriminant 33<br/>signed by market PDA]
```

---

## Notes

- **AI gating** cuma covers spawn dari `TrendingPoller` (cron + admin manual trigger). User-initiated spawn (`prepare-create`) bypass AI by design — user intent dianggap eksplisit.
- **CA spawning (asset_class=5) currently broken** post-MPL upgrade — Solana addresses are 32-44 bytes UTF-8, exceed both seed cap (32) dan MPL symbol cap (10). Pre-filter di `collectCAs` skips them. Fix butuh SC patch.
- **Trend identifier convention** `t:<slug>` ≤10 bytes (was `trend:` ≤32 bytes). Backward compat: `trendIdToKeyword` + `isTrendId` recognize both prefixes — markets di-spawn pre-convention tetep functional, just no MPL metadata.
- **bun --hot duplicate cron** dimitigasi via `globalThis.__tredieOracleUpdaterRunning` + `__tredieOracleCronRegistered` flags — survive module reload.
- **Helius webhook signature parse** has fallback chain: `tx.signature ?? tx.transaction?.signatures?.[0]` (raw vs enhanced format).
- **Elfa Auto webhook HMAC** uses `SHA256(ELFA_AUTO_WEBHOOK_SECRET)` as the signing key (not the raw secret) — `HMAC-SHA256(signing_key, ts.eventId.rawBody)`.
