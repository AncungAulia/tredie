import { Hono } from "hono";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import * as db from "../db";
import { sql } from "../db";
import { buildBuyTx, buildSellTx } from "../solana/instructions";
import { marketSpawner } from "../services/market-spawner";
import { connection } from "../solana/connection";
import { oraclePda } from "../solana/pda";
import { decodeOracle } from "../solana/decoder";
import * as elfaClient from "../elfa/client";
import {
  estimateBuy,
  estimateSell,
  applySlippageMin,
  getProtocolFeeBps,
  MarketCurveState,
} from "../services/amm-math";

export const marketsRoutes = new Hono();

let _solPriceCache: { price: number; ts: number } | null = null;

async function fetchSolPriceUsd(): Promise<number> {
  if (_solPriceCache && Date.now() - _solPriceCache.ts < 5 * 60 * 1000) {
    return _solPriceCache.price;
  }

  // Try sources in order; first success wins.
  const sources: Array<() => Promise<number>> = [
    // CryptoCompare — no auth, reliable from server environments including Railway
    async () => {
      const res = await fetch(
        "https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD",
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return 0;
      const d = (await res.json()) as { USD: number };
      return d.USD ?? 0;
    },
    // Binance — no auth, high rate limits
    async () => {
      const res = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return 0;
      const d = (await res.json()) as { price: string };
      return parseFloat(d.price);
    },
    // Bybit — no auth
    async () => {
      const res = await fetch(
        "https://api.bybit.com/v5/market/tickers?category=spot&symbol=SOLUSDT",
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return 0;
      const d = (await res.json()) as { result: { list: Array<{ lastPrice: string }> } };
      return parseFloat(d.result?.list?.[0]?.lastPrice ?? "0");
    },
    // CoinGecko — last resort (rate-limited from shared IPs)
    async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return 0;
      const d = (await res.json()) as { solana: { usd: number } };
      return d?.solana?.usd ?? 0;
    },
  ];

  for (const source of sources) {
    try {
      const price = await source();
      if (price > 0) {
        _solPriceCache = { price, ts: Date.now() };
        return price;
      }
    } catch {
      // try next source
    }
  }

  return _solPriceCache?.price ?? 0;
}

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

function curveStateOf(m: db.MarketRow): MarketCurveState {
  return {
    baseVirtualSol: BigInt(m.base_virtual_sol),
    virtualTokenSupply: BigInt(m.virtual_token_supply),
    realSolReserves: BigInt(m.real_sol_reserves),
    tokensMinted: BigInt(m.tokens_minted),
  };
}

/**
 * Derive token economics for a market in one place — keep this calc in sync
 * with the AMM curve in programs/.../buy.rs.
 *
 * spot_price_lamports = (base_virtual_sol + real_sol_reserves) /
 *                       (virtual_token_supply - tokens_minted)
 * market_cap_lamports = spot_price × tokens_minted     (circulating × price)
 * fdv_lamports        = spot_price × virtual_token_supply (fully diluted)
 * liquidity_lamports  = real_sol_reserves                (actual SOL in pool)
 *
 * Returns bigints as bigint (caller wraps via jsonSafe for serialization).
 */
function computeMarketEconomics(m: db.MarketRow): {
  spot_price_lamports: number;
  market_cap_lamports: bigint;
  fdv_lamports: bigint;
  liquidity_lamports: bigint;
} {
  const baseSol = BigInt(m.base_virtual_sol);
  const realSol = BigInt(m.real_sol_reserves);
  const virtSupply = BigInt(m.virtual_token_supply);
  const minted = BigInt(m.tokens_minted);

  const poolSol = baseSol + realSol;
  const poolTokens = virtSupply - minted;
  const spot = poolTokens > 0n ? Number(poolSol) / Number(poolTokens) : 0;

  // Number math is safe here: spot is small (~1e-5), supplies ~1e15, products
  // land in 1e10 range — well under Number.MAX_SAFE_INTEGER (~9e15).
  const market_cap_lamports = BigInt(Math.floor(spot * Number(minted)));
  const fdv_lamports = BigInt(Math.floor(spot * Number(virtSupply)));

  return {
    spot_price_lamports: spot,
    market_cap_lamports,
    fdv_lamports,
    liquidity_lamports: realSol,
  };
}

// Higher-level grouping for FE tabs. "token" covers all tradable asset
// classes (crypto/dex/equity/commodity/fx); "topic" is trend-class only.
// CA (class 5) is currently unspawnable so excluded from "token" too.
const TOKEN_CLASSES = [0, 1, 2, 3, 4];
const TOPIC_CLASSES = [6];

marketsRoutes.get("/", async (c) => {
  const assetClass = c.req.query("assetClass");
  const type = c.req.query("type"); // "token" | "topic"
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
  const sortBy = c.req.query("sortBy") ?? "mindshare";
  const order = c.req.query("order") === "asc" ? "ASC" : "DESC";
  const includeSparkline = c.req.query("sparkline") !== "false";

  const sortCol =
    sortBy === "volume" ? sql`real_sol_reserves` :
    sortBy === "created_at" ? sql`created_at` :
    sortBy === "market_cap" ? sql`(CAST(base_virtual_sol AS numeric) + CAST(real_sol_reserves AS numeric)) * CAST(tokens_minted AS numeric) / NULLIF(CAST(virtual_token_supply AS numeric) - CAST(tokens_minted AS numeric), 0)` :
    sql`current_mindshare_bps`;
  const dir = order === "ASC" ? sql`ASC` : sql`DESC`;

  // Resolve asset_class filter. assetClass takes precedence if both given.
  let classes: number[] | null = null;
  if (assetClass !== undefined && assetClass !== "") {
    classes = [Number(assetClass)];
  } else if (type === "token") {
    classes = TOKEN_CLASSES;
  } else if (type === "topic") {
    classes = TOPIC_CLASSES;
  } else if (type !== undefined && type !== "") {
    return c.json(
      { error: `type must be "token" or "topic" (got "${type}")` },
      400,
    );
  }

  // Pasar disembunyikan sampai punya gambar — kecuali kelas 4 (FX) dan 6
  // (tren/topik), yang memang tidak pernah diberi gambar: backfill-images
  // sengaja melewatinya karena letter-avatar sudah cukup (lihat admin.ts).
  // Tanpa pengecualian ini, seluruh pasar topik ikut tersembunyi — padahal
  // /topics adalah halaman default aplikasi.
  const rows =
    classes !== null
      ? await sql<db.MarketRow[]>`
          SELECT * FROM markets WHERE asset_class = ANY(${classes as any}) AND (image_url IS NOT NULL OR asset_class IN (4, 6))
          ORDER BY ${sortCol} ${dir} LIMIT ${limit} OFFSET ${offset}
        `
      : await sql<db.MarketRow[]>`
          SELECT * FROM markets WHERE (image_url IS NOT NULL OR asset_class IN (4, 6))
          ORDER BY ${sortCol} ${dir} LIMIT ${limit} OFFSET ${offset}
        `;

  const [{ count }] =
    classes !== null
      ? await sql<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count FROM markets WHERE asset_class = ANY(${classes as any}) AND (image_url IS NOT NULL OR asset_class IN (4, 6))
        `
      : await sql<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count FROM markets WHERE (image_url IS NOT NULL OR asset_class IN (4, 6))
        `;

  // Bulk-fetch 24h aggregates so list view doesn't N+1.
  const pdas = rows.map((r) => r.pda);
  const enriched: any[] = rows;

  if (pdas.length > 0) {
    const cutoffSec = BigInt(Math.floor(Date.now() / 1000) - 24 * 3600);
    const cutoffMs = BigInt(Date.now() - 24 * 3600_000);

    const [vol24h, holders, sparkRows, mcapRows] = await Promise.all([
      sql<{ market_pda: string; volume: bigint; trade_count: bigint }[]>`
        SELECT market_pda,
               COALESCE(SUM(sol_amount), 0)::bigint AS volume,
               COUNT(*)::bigint AS trade_count
        FROM trades
        WHERE market_pda = ANY(${pdas as any}) AND block_time > ${cutoffSec}
        GROUP BY market_pda
      `,
      sql<{ market_pda: string; holders: bigint }[]>`
        SELECT market_pda, COUNT(DISTINCT trader)::bigint AS holders
        FROM trades
        WHERE market_pda = ANY(${pdas as any})
        GROUP BY market_pda
      `,
      includeSparkline
        ? sql<{ market_pda: string; bucket: bigint; bps: number }[]>`
            SELECT market_pda,
                   ((recorded_at / 3600000) * 3600000)::bigint AS bucket,
                   AVG(current_bps)::int AS bps
            FROM mindshare_history
            WHERE market_pda = ANY(${pdas as any})
              AND recorded_at > ${cutoffMs}
            GROUP BY market_pda, bucket
            ORDER BY market_pda, bucket ASC
          `
        : Promise.resolve([] as any[]),
      // Market-cap sparkline: hourly buckets last 24h. For each bucket, last
      // trade's effective price × cumulative tokens_minted at bucket end.
      // Markets with zero trades in window get an empty array client-side.
      includeSparkline
        ? sql<{
            market_pda: string;
            bucket: bigint;
            cum_tokens: bigint;
            close_price: number;
          }[]>`
            WITH baseline AS (
              SELECT
                m.pda AS market_pda,
                m.tokens_minted::bigint - COALESCE(
                  (SELECT SUM(CASE WHEN t.side = 0 THEN t.token_amount ELSE -t.token_amount END)::bigint
                   FROM trades t
                   WHERE t.market_pda = m.pda AND t.block_time > ${cutoffSec}), 0
                ) AS baseline_tokens
              FROM markets m
              WHERE m.pda = ANY(${pdas as any})
            ),
            hourly AS (
              SELECT
                market_pda,
                ((block_time / 900) * 900)::bigint AS bucket,
                SUM(CASE WHEN side = 0 THEN token_amount ELSE -token_amount END)::bigint AS net_delta,
                (ARRAY_AGG(sol_amount   ORDER BY block_time DESC))[1] AS last_sol,
                (ARRAY_AGG(token_amount ORDER BY block_time DESC))[1] AS last_tokens
              FROM trades
              WHERE market_pda = ANY(${pdas as any}) AND block_time > ${cutoffSec}
              GROUP BY market_pda, bucket
            )
            SELECT
              h.market_pda,
              h.bucket,
              (b.baseline_tokens + SUM(h.net_delta) OVER (
                PARTITION BY h.market_pda ORDER BY h.bucket
              ))::bigint AS cum_tokens,
              (h.last_sol::numeric / NULLIF(h.last_tokens, 0)::numeric)::float AS close_price
            FROM hourly h
            JOIN baseline b ON b.market_pda = h.market_pda
            ORDER BY h.market_pda, h.bucket ASC
          `
        : Promise.resolve([] as any[]),
    ]);

    const volMap = new Map(vol24h.map((v) => [v.market_pda, v]));
    const holdersMap = new Map(holders.map((h) => [h.market_pda, h.holders]));
    const sparkMap = new Map<string, number[]>();
    for (const r of sparkRows) {
      const arr = sparkMap.get(r.market_pda) ?? [];
      arr.push(r.bps);
      sparkMap.set(r.market_pda, arr);
    }
    // mcap = close_price (lamports/token) × cum_tokens (token base units) → lamports
    const mcapMap = new Map<string, bigint[]>();
    const priceSparkMap = new Map<string, number[]>();
    for (const r of mcapRows) {
      if (!Number.isFinite(r.close_price) || r.close_price <= 0) continue;
      const raw = r.close_price * Number(r.cum_tokens);
      if (Number.isFinite(raw)) {
        const arr = mcapMap.get(r.market_pda) ?? [];
        arr.push(BigInt(Math.floor(raw)));
        mcapMap.set(r.market_pda, arr);
      }
      const priceArr = priceSparkMap.get(r.market_pda) ?? [];
      priceArr.push(r.close_price);
      priceSparkMap.set(r.market_pda, priceArr);
    }

    for (const m of enriched) {
      const v = volMap.get(m.pda);
      m.volume_24h_lamports = v?.volume ?? 0n;
      m.trade_count_24h = v?.trade_count ?? 0n;
      m.holders_count = holdersMap.get(m.pda) ?? 0n;
      if (includeSparkline) {
        m.sparkline_24h = sparkMap.get(m.pda) ?? [];
        m.market_cap_sparkline_24h = mcapMap.get(m.pda) ?? [];
        m.price_sparkline_24h = priceSparkMap.get(m.pda) ?? [];
      }

      // Token economics derived from AMM state — free since we already have the row
      const econ = computeMarketEconomics(m as db.MarketRow);
      m.spot_price_lamports = econ.spot_price_lamports;
      m.market_cap_lamports = econ.market_cap_lamports;
      m.fdv_lamports = econ.fdv_lamports;
      m.liquidity_lamports = econ.liquidity_lamports;
    }
  }

  const solPriceUsd = await fetchSolPriceUsd();
  return c.json(jsonSafe({ markets: enriched, total: count, sol_price_usd: solPriceUsd }));
});

marketsRoutes.get("/:identifier", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  if (id.length > 64) return c.json({ error: "Identifier too long" }, 400);
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);

  const cutoffSec = BigInt(Math.floor(Date.now() / 1000) - 24 * 3600);

  const [history, trades, vol, holdersCount, topHolders] = await Promise.all([
    db.getMindshareHistory(market.pda, 200),
    db.getRecentTrades(market.pda, 50),
    sql<{ volume: bigint; trade_count: bigint }[]>`
      SELECT COALESCE(SUM(sol_amount), 0)::bigint AS volume,
             COUNT(*)::bigint AS trade_count
      FROM trades
      WHERE market_pda = ${market.pda} AND block_time > ${cutoffSec}
    `,
    sql<{ holders: bigint }[]>`
      SELECT COUNT(DISTINCT trader)::bigint AS holders
      FROM trades WHERE market_pda = ${market.pda}
    `,
    sql<{ trader: string; tokens_bought: bigint; tokens_sold: bigint; net_tokens: bigint }[]>`
      SELECT
        trader,
        SUM(CASE WHEN side = 0 THEN token_amount ELSE 0 END)::bigint AS tokens_bought,
        SUM(CASE WHEN side = 1 THEN token_amount ELSE 0 END)::bigint AS tokens_sold,
        SUM(CASE WHEN side = 0 THEN token_amount ELSE -token_amount END)::bigint AS net_tokens
      FROM trades
      WHERE market_pda = ${market.pda}
      GROUP BY trader
      HAVING SUM(CASE WHEN side = 0 THEN token_amount ELSE -token_amount END) > 0
      ORDER BY net_tokens DESC
      LIMIT 50
    `,
  ]);

  // autoEvents = subset of mindshareHistory tagged as auto_event surges,
  // pre-filtered for FE chart annotations (rather than scanning client-side).
  const autoEvents = history.filter((h) => h.source === "auto_event");

  const econ = computeMarketEconomics(market);

  // Compute share % per holder relative to current circulating supply
  const tokensMinted = BigInt(market.tokens_minted);
  const holdersWithShare = topHolders.map((h, i) => ({
    rank: i + 1,
    trader: h.trader,
    net_tokens: h.net_tokens,
    tokens_bought: h.tokens_bought,
    tokens_sold: h.tokens_sold,
    share_bps: tokensMinted > 0n
      ? Number((h.net_tokens * 10_000n) / tokensMinted)
      : 0,
  }));

  const solPriceUsd = await fetchSolPriceUsd();

  return c.json(
    jsonSafe({
      market,
      mindshareHistory: history,
      recentTrades: trades,
      autoEvents,
      holders: holdersWithShare,
      stats: {
        volume_24h_lamports: vol[0]?.volume ?? 0n,
        trade_count_24h: vol[0]?.trade_count ?? 0n,
        holders_count: holdersCount[0]?.holders ?? 0n,
        spot_price_lamports_per_token: econ.spot_price_lamports,
        market_cap_lamports: econ.market_cap_lamports,
        fdv_lamports: econ.fdv_lamports,
        liquidity_lamports: econ.liquidity_lamports,
        sol_price_usd: solPriceUsd,
      },
    }),
  );
});

marketsRoutes.get("/:identifier/trades", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);
  const trades = await db.getRecentTrades(market.pda, limit);
  return c.json(jsonSafe({ trades }));
});

// On-chain oracle account state untuk live mindshare/ratchet meter.
marketsRoutes.get("/:identifier/oracle", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  if (id.length > 64) return c.json({ error: "Identifier too long" }, 400);
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);

  const marketPubkey = new PublicKey(market.pda);
  const [oraclePubkey] = oraclePda(marketPubkey);
  const acc = await connection.getAccountInfo(oraclePubkey);
  if (!acc) return c.json({ error: "Oracle account not found on-chain" }, 404);

  try {
    const decoded = decodeOracle(acc.data);
    return c.json(
      jsonSafe({
        oracle: {
          ...decoded,
          pda: oraclePubkey.toBase58(),
          // Convert unix seconds to ISO for convenience
          lastUpdateAt: new Date(Number(decoded.lastUpdateUnix) * 1000).toISOString(),
        },
      }),
    );
  } catch (e: any) {
    return c.json({ error: `Failed to decode oracle: ${e.message}` }, 500);
  }
});

// Derived OHLC candles dari trades. Fallback ke mindshare_history kalau gak ada trade.
const ohlcSchema = z.object({
  interval: z.enum(["5m", "10m", "15m", "1h", "4h", "1d"]).default("1h"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const INTERVAL_SECONDS: Record<string, number> = {
  "5m": 300, "10m": 600, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

marketsRoutes.get("/:identifier/ohlc", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  if (id.length > 64) return c.json({ error: "Identifier too long" }, 400);
  const parsed = ohlcSchema.safeParse({
    interval: c.req.query("interval"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { interval, limit } = parsed.data;
  const intervalSec = INTERVAL_SECONDS[interval];

  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);

  // Compute price per trade as sol_amount / token_amount × 1e9 (lamports per token).
  // Bucket by floor(block_time / intervalSec).
  const candles = await sql<{
    bucket: bigint;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: bigint;
    trade_count: bigint;
  }[]>`
    WITH priced AS (
      SELECT
        (block_time / ${intervalSec}) * ${intervalSec} AS bucket,
        block_time,
        sol_amount,
        token_amount,
        (sol_amount::numeric / NULLIF(token_amount, 0)::numeric) AS price
      FROM trades
      WHERE market_pda = ${market.pda} AND token_amount > 0
    ),
    ranked AS (
      SELECT
        bucket,
        ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY block_time ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY block_time DESC) AS rn_desc,
        price,
        sol_amount
      FROM priced
    )
    SELECT
      bucket,
      MAX(price) FILTER (WHERE rn_asc = 1)::float AS open,
      MAX(price) FILTER (WHERE rn_desc = 1)::float AS close,
      MAX(price)::float AS high,
      MIN(price)::float AS low,
      SUM(sol_amount)::bigint AS volume,
      COUNT(*)::bigint AS trade_count
    FROM ranked
    GROUP BY bucket
    ORDER BY bucket DESC
    LIMIT ${limit}
  `;

  // Fallback: kalo gak ada trade sama sekali, derive proxy series dari mindshare_history.
  // Frontend bisa show "no trades yet, mindshare-only view".
  if (candles.length === 0) {
    const history = await sql<{ bucket: bigint; bps: number }[]>`
      SELECT
        ((recorded_at / 1000) / ${intervalSec}) * ${intervalSec} AS bucket,
        AVG(current_bps)::int AS bps
      FROM mindshare_history
      WHERE market_pda = ${market.pda}
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT ${limit}
    `;
    return c.json(
      jsonSafe({
        candles: [],
        mindshareSeries: history.reverse(),
        source: "mindshare_history",
        interval,
      }),
    );
  }

  return c.json(
    jsonSafe({
      candles: candles.reverse(),
      source: "trades",
      interval,
    }),
  );
});

// AI thesis untuk market detail page (Elfa Chat).
marketsRoutes.get("/:identifier/ai-context", async (c) => {
  const id = decodeURIComponent(c.req.param("identifier"));
  if (id.length > 64) return c.json({ error: "Identifier too long" }, 400);
  const market = await db.getMarketByIdentifier(id);
  if (!market) return c.json({ error: "Market not found" }, 404);

  // Trend markets pakai prompt khusus (gak ada price chart, fokus narrative).
  // Tradeable assets pakai analysisType=chat dengan ticker context.
  let prompt: string;
  if (market.asset_class === 6) {
    const keyword = elfaClient.trendIdToKeyword(market.identifier) ?? market.identifier;
    prompt =
      `Give me a 2-3 sentence analysis of the cultural moment or trend "${keyword}". ` +
      `Why is it currently trending? What audience or behavior is driving it? ` +
      `What might cause it to fade or accelerate in the next 24-48h?`;
  } else {
    const symbol = market.identifier;
    prompt =
      `Give me a 2-3 sentence trade thesis for ${symbol}. Cover current sentiment, ` +
      `key catalysts in the next 24-48h, and main risk factors. Be concise and concrete.`;
  }

  try {
    const res = await elfaClient.elfaChat(prompt, "fast");
    return c.json({
      identifier: market.identifier,
      assetClass: market.asset_class,
      message: res.message,
      sessionId: res.sessionId,
    });
  } catch (e: any) {
    return c.json({ error: `Elfa Chat failed: ${e.message}` }, 502);
  }
});

const estimateSchema = z.object({
  identifier: z.string(),
  side: z.enum(["buy", "sell"]),
  solAmount: z.number().positive().optional(),
  tokenAmount: z.string().optional(),
  slippageBps: z.number().int().min(0).max(10000).default(100),
});

// Preview the buy/sell output without building a tx. Mirrors the SC AMM curve
// exactly so frontend can show the user "you will receive ~N tokens" before
// signing.
marketsRoutes.post("/estimate", async (c) => {
  const body = estimateSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { identifier, side, solAmount, tokenAmount, slippageBps } = body.data;

  const market = await db.getMarketByIdentifier(identifier);
  if (!market) return c.json({ error: "Market not found" }, 404);

  const feeBps = await getProtocolFeeBps();
  const state = curveStateOf(market);

  try {
    if (side === "buy") {
      if (solAmount === undefined)
        return c.json({ error: "solAmount required for buy" }, 400);
      const solIn = BigInt(Math.floor(solAmount * 1e9));
      const est = estimateBuy(state, solIn, feeBps);
      const minOut = applySlippageMin(est.tokensOut, slippageBps);
      return c.json(
        jsonSafe({
          side: "buy",
          input: { solIn },
          output: {
            tokensOut: est.tokensOut,
            minTokensOut: minOut,
          },
          fee: { lamports: est.fee, bps: feeBps },
          price: {
            effective: est.effectivePrice,
            spotBefore: est.spotPriceBefore,
            spotAfter: est.spotPriceAfter,
            impactBps: est.priceImpactBps,
          },
          slippageBps,
        }),
      );
    } else {
      if (!tokenAmount)
        return c.json({ error: "tokenAmount required for sell" }, 400);
      const tokensIn = BigInt(tokenAmount);
      const est = estimateSell(state, tokensIn, feeBps);
      const minOut = applySlippageMin(est.solOut, slippageBps);
      return c.json(
        jsonSafe({
          side: "sell",
          input: { tokensIn },
          output: {
            solOut: est.solOut,
            minSolOut: minOut,
          },
          fee: { lamports: est.fee, bps: feeBps },
          price: {
            effective: est.effectivePrice,
            spotBefore: est.spotPriceBefore,
            spotAfter: est.spotPriceAfter,
            impactBps: est.priceImpactBps,
          },
          slippageBps,
        }),
      );
    }
  } catch (e: any) {
    return c.json({ error: `Estimate failed: ${e?.message ?? e}` }, 400);
  }
});

const prepareTradeSchema = z.object({
  identifier: z.string(),
  side: z.enum(["buy", "sell"]),
  solAmount: z.number().positive().optional(),
  tokenAmount: z.string().optional(),
  slippageBps: z.number().int().min(0).max(10000).default(100),
  trader: z.string(),
});

marketsRoutes.post("/prepare-trade", async (c) => {
  const body = prepareTradeSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { identifier, side, solAmount, tokenAmount, slippageBps, trader } =
    body.data;

  const market = await db.getMarketByIdentifier(identifier);
  if (!market) return c.json({ error: "Market not found" }, 404);

  let traderPk: PublicKey;
  try {
    traderPk = new PublicKey(trader);
  } catch {
    return c.json({ error: "Invalid trader pubkey" }, 400);
  }
  const mintPk = new PublicKey(market.mint);

  // Re-estimate server-side and apply slippage so on-chain min_out enforces
  // protection against sandwich/MEV between estimate and execution.
  const feeBps = await getProtocolFeeBps();
  const state = curveStateOf(market);

  let tx;
  let estimate: any;
  try {
    if (side === "buy") {
      if (solAmount === undefined)
        return c.json({ error: "solAmount required for buy" }, 400);
      const solIn = BigInt(Math.floor(solAmount * 1e9));
      const est = estimateBuy(state, solIn, feeBps);
      const minTokensOut = applySlippageMin(est.tokensOut, slippageBps);
      estimate = {
        tokensOut: est.tokensOut.toString(),
        minTokensOut: minTokensOut.toString(),
        priceImpactBps: est.priceImpactBps,
      };
      tx = await buildBuyTx({
        buyer: traderPk,
        identifier,
        mintPubkey: mintPk,
        solAmountIn: solIn,
        minTokensOut,
      });
    } else {
      if (!tokenAmount)
        return c.json({ error: "tokenAmount required for sell" }, 400);
      const tokensIn = BigInt(tokenAmount);
      const est = estimateSell(state, tokensIn, feeBps);
      const minSolOut = applySlippageMin(est.solOut, slippageBps);
      estimate = {
        solOut: est.solOut.toString(),
        minSolOut: minSolOut.toString(),
        priceImpactBps: est.priceImpactBps,
      };
      tx = await buildSellTx({
        seller: traderPk,
        identifier,
        mintPubkey: mintPk,
        tokensIn,
        minSolOut,
      });
    }
  } catch (e: any) {
    return c.json({ error: `Trade prep failed: ${e?.message ?? e}` }, 400);
  }

  return c.json({
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    estimate,
  });
});

const prepareCreateSchema = z.object({
  identifier: z.string().min(1).max(10),
  source: z
    .enum(["user_search", "user_link_paste", "auto_spawn"])
    .default("user_search"),
  assetClass: z.number().int().min(0).max(6).default(0),
  // displayName flows into the on-chain Metaplex `name` field — show users
  // a readable label like "Bitcoin" instead of the raw "aBTC" identifier.
  displayName: z.string().min(1).max(64).optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

marketsRoutes.post("/prepare-create", async (c) => {
  const body = prepareCreateSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const existing = await db.getMarketByIdentifier(body.data.identifier);
  if (existing)
    return c.json(jsonSafe({ market: existing, alreadyExists: true }));

  try {
    const market = await marketSpawner.ensureMarket({
      identifier: body.data.identifier,
      assetClass: body.data.assetClass,
      source: body.data.source,
      displayName: body.data.displayName ?? null,
      imageUrl: body.data.imageUrl ?? null,
      sourceUrl: body.data.sourceUrl ?? null,
      sourceMetadata: body.data.sourceMetadata ?? null,
    });
    return c.json(jsonSafe({ market, alreadyExists: false }));
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
