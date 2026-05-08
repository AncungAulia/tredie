/**
 * OpenAPI 3.1 spec — hand-curated, one source of truth for /api/docs UI.
 * Keep in sync with route handlers di src/api/*.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Tredie Backend API",
    version: "0.1.0",
    description:
      "Backend untuk Tredie — attention market protocol di Solana devnet. " +
      "Menjembatani Elfa AI (social signal), Solana program `EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU`, " +
      "dan frontend (Next.js) via Postgres+Realtime.",
  },
  servers: [{ url: "http://localhost:4000", description: "Local dev" }],
  tags: [
    { name: "health", description: "Liveness + per-component probes" },
    { name: "markets", description: "Market data, oracle, OHLC, trade prep" },
    { name: "factory", description: "On-chain factory state" },
    { name: "trending", description: "Elfa-cached trending tokens & CAs" },
    { name: "search", description: "Type-ahead by ticker, CA, or trend phrase" },
    { name: "resolve-link", description: "Paste social link → metadata + extracted symbol" },
    { name: "auto-queries", description: "Auto hype watcher state (debug/observability)" },
    { name: "admin", description: "Manual triggers for cron jobs" },
    { name: "portfolio", description: "Per-wallet positions, PnL, and trade activity" },
    { name: "webhooks", description: "Inbound from Helius + Elfa Auto" },
  ],
  paths: {
    "/api/v1/health": {
      get: {
        tags: ["health"],
        summary: "Combined health: DB + Solana RPC",
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/HealthOk" } } } },
          "503": { description: "Service unavailable" },
        },
      },
    },
    "/api/v1/health/db": {
      get: { tags: ["health"], summary: "Postgres probe", responses: { "200": { description: "OK" }, "503": { description: "Down" } } },
    },
    "/api/v1/health/solana": {
      get: { tags: ["health"], summary: "Solana RPC probe (getSlot)", responses: { "200": { description: "OK" }, "503": { description: "Down" } } },
    },
    "/api/v1/health/elfa": {
      get: { tags: ["health"], summary: "Elfa API probe (/v2/ping)", responses: { "200": { description: "OK" }, "503": { description: "Down" } } },
    },

    "/api/v1/factory": {
      get: {
        tags: ["factory"],
        summary: "Decoded MarketFactory account + DB cross-check",
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/FactoryResponse" } } } },
          "404": { description: "Factory not initialized on-chain" },
        },
      },
    },

    "/api/v1/markets": {
      get: {
        tags: ["markets"],
        summary: "List markets",
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["token", "topic"] }, description: "High-level group for FE tabs. token=tradable assets (classes 0-4), topic=trends (class 6). assetClass takes precedence if both given." },
          { name: "assetClass", in: "query", schema: { type: "integer", minimum: 0, maximum: 6 }, description: "0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA 6=trend" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["mindshare", "volume"], default: "mindshare" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
          { name: "sparkline", in: "query", schema: { type: "boolean", default: true }, description: "Set false to skip the 24h sparkline aggregate (faster)." },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MarketsList" } } } }, "400": { description: "Invalid type value" } },
      },
    },
    "/api/v1/markets/{identifier}": {
      get: {
        tags: ["markets"],
        summary: "Market detail + mindshare history + recent trades",
        parameters: [{ name: "identifier", in: "path", required: true, schema: { type: "string" }, example: "aBTC" }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/markets/{identifier}/trades": {
      get: {
        tags: ["markets"],
        summary: "Recent trades for a market",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Market not found" } },
      },
    },
    "/api/v1/markets/{identifier}/oracle": {
      get: {
        tags: ["markets"],
        summary: "Decoded MindshareOracle account state on-chain",
        parameters: [{ name: "identifier", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/OracleResponse" } } } },
          "404": { description: "Market or oracle not found" },
        },
      },
    },
    "/api/v1/markets/{identifier}/ohlc": {
      get: {
        tags: ["markets"],
        summary: "Derived OHLC candles dari trades, fallback ke mindshare_history kalo gak ada trade",
        parameters: [
          { name: "identifier", in: "path", required: true, schema: { type: "string" } },
          { name: "interval", in: "query", schema: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], default: "1h" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
        ],
        responses: { "200": { description: "OK" }, "400": { description: "Invalid interval" }, "404": { description: "Market not found" } },
      },
    },
    "/api/v1/markets/{identifier}/ai-context": {
      get: {
        tags: ["markets"],
        summary: "AI-generated thesis via Elfa Chat. ⚠️ Free tier returns 502 (chat scope blocked)",
        parameters: [{ name: "identifier", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Market not found" }, "502": { description: "Elfa Chat unavailable (paid tier required)" } },
      },
    },
    "/api/v1/markets/estimate": {
      post: {
        tags: ["markets"],
        summary: "Preview buy/sell output (mirrors on-chain AMM) without building a tx",
        description:
          "Server-side AMM math identical to the on-chain program. Returns tokensOut/solOut, fee, price impact, and minOut after slippage. Use this to populate the trade preview before the user signs.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/EstimateRequest" } } },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/EstimateResponse" } } } },
          "400": { description: "Validation error / curve math failed" },
          "404": { description: "Market not found" },
        },
      },
    },
    "/api/v1/markets/prepare-trade": {
      post: {
        tags: ["markets"],
        summary: "Build unsigned buy/sell tx with server-side slippage protection",
        description:
          "Backend re-runs the estimate, derives min_tokens_out / min_sol_out from slippageBps, and bakes that into the on-chain instruction. Response includes the unsigned base64 tx plus the estimate used.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PrepareTradeRequest" } } },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PrepareTradeResponse" } } } },
          "400": { description: "Validation error" },
          "404": { description: "Market not found" },
        },
      },
    },
    "/api/v1/markets/prepare-create": {
      post: {
        tags: ["markets"],
        summary: "Idempotent market spawn — returns existing or creates fresh on-chain",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PrepareCreateRequest" } } },
        },
        responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { market: { type: "object" }, alreadyExists: { type: "boolean" } } } } } } },
      },
    },

    "/api/v1/trending/tokens": {
      get: {
        tags: ["trending"],
        summary: "Cached Elfa trending-tokens (last 20 min) joined with our markets table",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/trending/cas/{platform}": {
      get: {
        tags: ["trending"],
        summary: "Cached Elfa trending-cas (twitter|telegram)",
        parameters: [{ name: "platform", in: "path", required: true, schema: { type: "string", enum: ["twitter", "telegram"] } }],
        responses: { "200": { description: "OK" }, "400": { description: "Invalid platform" } },
      },
    },

    "/api/v1/search": {
      get: {
        tags: ["search"],
        summary: "Type-ahead suggestions (ticker, base58 CA, trend phrase)",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResponse" } } } } },
      },
    },

    "/api/v1/resolve-link": {
      post: {
        tags: ["resolve-link"],
        summary: "Paste a social URL → extract platform metadata + suggest market identifier",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri" } } } } },
        },
        responses: { "200": { description: "OK" }, "400": { description: "Invalid URL" } },
      },
    },

    "/api/v1/auto-queries": {
      get: {
        tags: ["auto-queries"],
        summary: "List Auto hype watcher state (active + cancelled + expired + failed) for observability",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "cancelled", "expired", "failed"] } },
          { name: "marketPda", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },

    "/api/v1/portfolio/{address}": {
      get: {
        tags: ["portfolio"],
        summary: "Per-wallet positions, aggregate stats, and recent activity",
        description:
          "All data derived from the trades table joined with markets. Positions include unrealized PnL valued at current AMM spot price. Realized PnL is approximated via proportional cost basis (not strict FIFO).",
        parameters: [
          { name: "address", in: "path", required: true, schema: { type: "string" }, description: "Solana base58 wallet pubkey" },
          { name: "limit", in: "query", schema: { type: "integer", default: 200, maximum: 500 }, description: "Activity rows to return" },
        ],
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PortfolioResponse" } } } },
          "400": { description: "Invalid address" },
        },
      },
    },

    "/api/v1/admin/poll-trending": {
      post: {
        tags: ["admin"],
        summary: "Force-trigger trending poller (narratives + tokens + CAs)",
        responses: { "200": { description: "OK" }, "500": { description: "Internal" } },
      },
    },
    "/api/v1/admin/update-oracles": {
      post: {
        tags: ["admin"],
        summary: "Force-trigger oracle update for all markets",
        responses: { "200": { description: "OK" }, "500": { description: "Internal" } },
      },
    },
    "/api/v1/admin/scan-hype": {
      post: {
        tags: ["admin"],
        summary: "Force-trigger local hype detector (replaces broken Elfa Auto subscription path)",
        responses: { "200": { description: "OK" }, "500": { description: "Internal" } },
      },
    },
    "/api/v1/admin/force-hype": {
      post: {
        tags: ["admin"],
        summary: "Demo: artificially fire a hype event for a market (useful when real Elfa data is sparse)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["identifier"], properties: { identifier: { type: "string" }, bps: { type: "integer", description: "Override boosted bps (default: peak + HYPE_EVENT_PREMIUM_BPS)" } } } } },
        },
        responses: { "200": { description: "OK" }, "400": { description: "identifier required" }, "500": { description: "Internal" } },
      },
    },

    "/api/webhooks/elfa": {
      post: {
        tags: ["webhooks"],
        summary: "Inbound Elfa Auto webhook (HMAC verified)",
        description:
          "Headers required: `X-Auto-Signature: v1=<hex>`, `X-Auto-Signature-Timestamp`, `X-Auto-Event-Id`. " +
          "Verifier: `signing_key = SHA256(ELFA_AUTO_WEBHOOK_SECRET); HMAC-SHA256(signing_key, ts.eventId.body)`.",
        responses: { "202": { description: "Accepted (queued)" }, "200": { description: "Duplicate eventId" }, "400": { description: "Missing headers" }, "401": { description: "Invalid signature or stale timestamp" } },
      },
    },
    "/api/webhooks/helius": {
      post: {
        tags: ["webhooks"],
        summary: "Inbound Helius transaction webhook (Bearer auth)",
        description: "Header required: `Authorization: Bearer <HELIUS_WEBHOOK_SECRET>`. Body: array of enhanced tx objects.",
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" }, "400": { description: "Invalid JSON" } },
      },
    },
  },
  components: {
    schemas: {
      HealthOk: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          version: { type: "string" },
          stack: { type: "string" },
          slot: { type: "integer" },
          lastIndexedTrade: { type: "string", nullable: true },
          checks: { type: "object", properties: { db: { type: "boolean" }, solana: { type: "boolean" } } },
        },
      },
      FactoryResponse: {
        type: "object",
        properties: {
          factory: {
            type: "object",
            properties: {
              authority: { type: "string" },
              feeRecipient: { type: "string" },
              marketCount: { type: "string", description: "u64 as string" },
              feeBasisPoints: { type: "integer" },
              paused: { type: "boolean" },
              pda: { type: "string" },
            },
          },
          dbMarketCount: { type: "string" },
          assetClassBreakdown: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      MarketsList: {
        type: "object",
        properties: {
          markets: { type: "array", items: { $ref: "#/components/schemas/Market" } },
          total: { type: "string" },
        },
      },
      Market: {
        type: "object",
        properties: {
          identifier: { type: "string", example: "aBTC" },
          pda: { type: "string" },
          mint: { type: "string" },
          asset_class: { type: "integer", minimum: 0, maximum: 6 },
          display_name: { type: "string", nullable: true },
          base_virtual_sol: { type: "string" },
          virtual_token_supply: { type: "string" },
          real_sol_reserves: { type: "string" },
          tokens_minted: { type: "string" },
          current_mindshare_bps: { type: "integer" },
          peak_mindshare_bps: { type: "integer" },
          ratchet_multiplier_bps: { type: "integer" },
          creator_pubkey: { type: "string" },
          creator_source: { type: "string", enum: ["auto_spawn", "user_search", "user_link_paste"] },
          created_at: { type: "string" },
        },
      },
      OracleResponse: {
        type: "object",
        properties: {
          oracle: {
            type: "object",
            properties: {
              currentMindshareBps: { type: "integer" },
              peakMindshareBps: { type: "integer" },
              ratchetMultiplierBps: { type: "integer" },
              elasticityBps: { type: "integer" },
              authority: { type: "string" },
              updateCount: { type: "string" },
              lastUpdateUnix: { type: "string" },
              lastUpdateAt: { type: "string", format: "date-time" },
              minUpdateIntervalSecs: { type: "string" },
              pda: { type: "string" },
            },
          },
        },
      },
      PrepareTradeRequest: {
        type: "object",
        required: ["identifier", "side", "trader"],
        properties: {
          identifier: { type: "string", example: "BTC" },
          side: { type: "string", enum: ["buy", "sell"] },
          solAmount: { type: "number", description: "Required for side=buy. SOL units." },
          tokenAmount: { type: "string", description: "Required for side=sell. Raw token units (u64)." },
          slippageBps: { type: "integer", default: 100 },
          trader: { type: "string", description: "Wallet pubkey" },
        },
      },
      PrepareCreateRequest: {
        type: "object",
        required: ["identifier"],
        properties: {
          identifier: { type: "string", maxLength: 10, example: "aBTC" },
          assetClass: { type: "integer", minimum: 0, maximum: 6, default: 0 },
          source: { type: "string", enum: ["user_search", "user_link_paste", "auto_spawn"], default: "user_search" },
          sourceMetadata: { type: "object", additionalProperties: true },
        },
      },
      SearchResponse: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["symbol", "ca", "trend"] },
                value: { type: "string" },
                display: { type: "string" },
                marketPda: { type: "string", nullable: true },
                ratchetBps: { type: "integer", nullable: true },
              },
            },
          },
        },
      },
      EstimateRequest: {
        type: "object",
        required: ["identifier", "side"],
        properties: {
          identifier: { type: "string", example: "BTC" },
          side: { type: "string", enum: ["buy", "sell"] },
          solAmount: { type: "number", description: "SOL units. Required for side=buy." },
          tokenAmount: { type: "string", description: "Raw u64 base units. Required for side=sell." },
          slippageBps: { type: "integer", default: 100, minimum: 0, maximum: 10000 },
        },
      },
      EstimateResponse: {
        type: "object",
        properties: {
          side: { type: "string", enum: ["buy", "sell"] },
          input: { type: "object", description: "Echo of input bigints as strings" },
          output: {
            type: "object",
            properties: {
              tokensOut: { type: "string", description: "Buy: estimated tokens (base units, bigint string)" },
              minTokensOut: { type: "string", description: "Buy: tokensOut after slippage tolerance" },
              solOut: { type: "string", description: "Sell: estimated lamports out" },
              minSolOut: { type: "string", description: "Sell: solOut after slippage tolerance" },
            },
          },
          fee: {
            type: "object",
            properties: {
              lamports: { type: "string" },
              bps: { type: "integer" },
            },
          },
          price: {
            type: "object",
            properties: {
              effective: { type: "number", description: "lamports / token base unit for this trade" },
              spotBefore: { type: "number" },
              spotAfter: { type: "number" },
              impactBps: { type: "integer", description: "(effective - spotBefore) / spotBefore in bps" },
            },
          },
          slippageBps: { type: "integer" },
        },
      },
      PrepareTradeResponse: {
        type: "object",
        properties: {
          transaction: { type: "string", description: "base64 unsigned tx" },
          estimate: {
            type: "object",
            description:
              "Echo of the estimate the backend used to derive on-chain min_out — same numbers FE saw in /estimate, baked into the tx as slippage protection.",
            properties: {
              tokensOut: { type: "string", nullable: true },
              minTokensOut: { type: "string", nullable: true },
              solOut: { type: "string", nullable: true },
              minSolOut: { type: "string", nullable: true },
              priceImpactBps: { type: "integer" },
            },
          },
        },
      },
      PortfolioResponse: {
        type: "object",
        properties: {
          address: { type: "string" },
          positions: {
            type: "array",
            items: { $ref: "#/components/schemas/PortfolioPosition" },
          },
          stats: { $ref: "#/components/schemas/PortfolioStats" },
          activity: {
            type: "array",
            items: { $ref: "#/components/schemas/PortfolioActivity" },
          },
        },
      },
      PortfolioPosition: {
        type: "object",
        description:
          "Per-market aggregate. Tokens stored as bigint strings (base units, decimals=6). Lamport amounts also bigint strings.",
        properties: {
          market_pda: { type: "string" },
          identifier: { type: "string" },
          display_name: { type: "string", nullable: true },
          asset_class: { type: "integer" },
          mint: { type: "string" },
          current_mindshare_bps: { type: "integer" },
          ratchet_multiplier_bps: { type: "integer" },
          tokens_bought: { type: "string" },
          tokens_sold: { type: "string" },
          tokens_held: { type: "string" },
          sol_invested_lamports: { type: "string" },
          sol_received_lamports: { type: "string" },
          avg_entry_price_lamports: { type: "number", description: "lamports / token base unit" },
          current_spot_price_lamports: { type: "number" },
          held_value_lamports: { type: "string" },
          held_cost_basis_lamports: { type: "string" },
          realized_pnl_lamports: { type: "string", description: "Approximation via proportional cost basis (not strict FIFO)" },
          unrealized_pnl_lamports: { type: "string" },
          buy_count: { type: "string" },
          sell_count: { type: "string" },
          first_buy_at: { type: "string", nullable: true, description: "block_time of first buy (unix sec, bigint string)" },
          last_trade_at: { type: "string", nullable: true },
        },
      },
      PortfolioStats: {
        type: "object",
        properties: {
          total_trades: { type: "integer" },
          buy_count: { type: "integer" },
          sell_count: { type: "integer" },
          closed_trades: { type: "integer", description: "Positions where tokens_held == 0 and at least one sell" },
          win_rate_bps: { type: "integer", description: "Percent of closed trades with realized PnL > 0, in bps (10000 = 100%)" },
          total_volume_lamports: { type: "string" },
          sol_spent_lamports: { type: "string" },
          sol_received_lamports: { type: "string" },
          realized_pnl_lamports: { type: "string" },
          unrealized_pnl_lamports: { type: "string" },
          total_held_value_lamports: { type: "string" },
          avg_profit_per_trade_lamports: { type: "number" },
        },
      },
      PortfolioActivity: {
        type: "object",
        description: "Single trade joined with its market identifier for FE convenience.",
        properties: {
          signature: { type: "string" },
          market_pda: { type: "string" },
          identifier: { type: "string" },
          display_name: { type: "string", nullable: true },
          asset_class: { type: "integer" },
          side: { type: "integer", enum: [0, 1], description: "0=buy, 1=sell" },
          sol_amount: { type: "string" },
          token_amount: { type: "string" },
          ratchet_bps: { type: "integer" },
          block_time: { type: "string", description: "unix seconds" },
          slot: { type: "string" },
        },
      },
    },
  },
} as const;
