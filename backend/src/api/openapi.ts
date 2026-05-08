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
          { name: "assetClass", in: "query", schema: { type: "integer", minimum: 0, maximum: 6 }, description: "0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA 6=trend" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["mindshare", "volume"], default: "mindshare" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/MarketsList" } } } } },
      },
    },
    "/api/v1/markets/{identifier}": {
      get: {
        tags: ["markets"],
        summary: "Market detail + mindshare history + recent trades",
        parameters: [{ name: "identifier", in: "path", required: true, schema: { type: "string" }, example: "BTC" }],
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
    "/api/v1/markets/prepare-trade": {
      post: {
        tags: ["markets"],
        summary: "Build unsigned buy/sell tx for frontend wallet to sign",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PrepareTradeRequest" } } },
        },
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { transaction: { type: "string", description: "base64 unsigned tx" } } } } } },
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
          identifier: { type: "string", example: "t:cnbadd" },
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
          identifier: { type: "string", maxLength: 32, example: "t:trend123" },
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
    },
  },
} as const;
