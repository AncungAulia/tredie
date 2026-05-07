import cron from "node-cron";
import { PublicKey } from "@solana/web3.js";
import * as db from "../db";
import * as elfa from "../elfa/client";
import { buildUpdateMindshareTx, sendAndConfirm } from "../solana/instructions";
import { connection } from "../solana/connection";
import { oraclePda } from "../solana/pda";
import { decodeOracle } from "../solana/decoder";
import { log } from "../utils/log";

const MINDSHARE_BPS_MAX = 100_000;
const ELASTICITY_BPS = 5000;
const RATCHET_BASE_BPS = 10_000;
const MAX_RATCHET_BPS = 50_000;
// 30s safety buffer above on-chain min_update_interval_secs to avoid
// boundary-condition rejects from clock skew or RPC latency.
const SAFETY_BUFFER_SECS = 30;
// Stagger between sequential market updates to avoid Helius RPC 429 storms.
const PER_MARKET_DELAY_MS = 250;

// Process-wide lock — survives bun --hot module reloads where a per-instance
// flag would let two parallel updateAll runs slip through.
declare global {
  // eslint-disable-next-line no-var
  var __tredieOracleUpdaterRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __tredieOracleCronRegistered: boolean | undefined;
}

export class OracleUpdater {
  start() {
    // Guard against duplicate cron registration when bun --hot reloads the module
    if (globalThis.__tredieOracleCronRegistered) {
      log.debug("Oracle cron already registered (hot reload), skipping");
      return;
    }
    globalThis.__tredieOracleCronRegistered = true;
    cron.schedule("*/15 * * * *", () => {
      this.updateAll().catch((e) =>
        log.error({ err: e }, "Oracle update all failed"),
      );
    });
    log.info("OracleUpdater started (every 15 min)");
  }

  async updateAll() {
    if (globalThis.__tredieOracleUpdaterRunning) {
      log.debug("updateAll already in progress (process-wide), skipping concurrent invocation");
      return;
    }
    globalThis.__tredieOracleUpdaterRunning = true;
    const started = Date.now();
    let attempted = 0;
    let updated = 0;
    let skipped = 0;
    try {
      const markets = await db.getAllActiveMarkets();
      for (const m of markets) {
        attempted++;
        try {
          const result = await this.updateOne(m);
          if (result === "updated") updated++;
          else skipped++;
        } catch (e) {
          log.warn({ err: e, pda: m.pda }, "updateOne failed");
        }
        if (PER_MARKET_DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, PER_MARKET_DELAY_MS));
        }
      }
    } finally {
      log.info(
        {
          attempted,
          updated,
          skipped,
          elapsedMs: Date.now() - started,
        },
        "Oracle updateAll completed",
      );
      globalThis.__tredieOracleUpdaterRunning = false;
    }
  }

  /**
   * Returns "updated" if on-chain tx fired, "skipped" otherwise (interval not
   * elapsed, no fresh signal, etc). Throws on real errors only.
   */
  async updateOne(market: db.MarketRow): Promise<"updated" | "skipped"> {
    // Source of truth = on-chain oracle account. Skip RPC dance if interval
    // hasn't elapsed; reading the account is one cheap getAccountInfo call.
    try {
      const [oraclePubkey] = oraclePda(new PublicKey(market.pda));
      const acc = await connection.getAccountInfo(oraclePubkey);
      if (acc) {
        const decoded = decodeOracle(acc.data);
        const nowSec = Math.floor(Date.now() / 1000);
        const elapsed = nowSec - Number(decoded.lastUpdateUnix);
        const minInterval = Number(decoded.minUpdateIntervalSecs) + SAFETY_BUFFER_SECS;
        if (elapsed < minInterval) {
          log.debug(
            { identifier: market.identifier, elapsed, minInterval },
            "Oracle interval not elapsed on-chain — skip",
          );
          return "skipped";
        }
      }
    } catch (e) {
      log.debug({ err: e, identifier: market.identifier }, "Oracle pre-check failed, proceeding");
    }

    const bps = await this.fetchMindshareBps(market);
    if (bps === 0) return "skipped";

    await this.submit(market.pda, market.identifier, bps);
    return "updated";
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

    const mkt = (await db.getMarketByPda(marketPda))!;
    const peak = Math.max(mkt.peak_mindshare_bps, bps);
    const ratchet = Math.min(
      MAX_RATCHET_BPS,
      RATCHET_BASE_BPS + Math.floor((peak * ELASTICITY_BPS) / 10_000),
    );
    await db.updateMarketMindshare(marketPda, bps, peak, ratchet);

    log.info({ identifier, bps, sig }, "Oracle updated");
  }

  /**
   * Mindshare derivation per asset class:
   *   crypto/dex (0,1)         → relative share dari trending-tokens batch (poller cache)
   *   equity/commodity/fx (2-4) → top-mentions metadata.total × scale
   *   CA (5)                   → trending_cas.mention_count × scale (DB cache)
   *   trend (6)                → keyword-mentions metadata.total × scale
   *
   * Returns 0 jika data tidak tersedia — caller skip update.
   */
  async fetchMindshareBps(market: db.MarketRow): Promise<number> {
    if (market.asset_class < 2) {
      const cached = await db.getLatestTrendingToken(market.identifier);
      if (cached && Date.now() - Number(cached.fetched_at) < 20 * 60 * 1000) {
        return Math.min(
          MINDSHARE_BPS_MAX,
          Math.round((cached.mindshare_pct ?? 0) * 100),
        );
      }
      try {
        const res = await elfa.getTopMentions(market.identifier, "1h");
        return elfa.topMentionsToBps(res.metadata?.total ?? 0, 10);
      } catch {
        return 0;
      }
    }

    if (market.asset_class >= 2 && market.asset_class <= 4) {
      try {
        const res = await elfa.getTopMentions(market.identifier, "1h");
        return elfa.topMentionsToBps(res.metadata?.total ?? 0, 5);
      } catch {
        return 0;
      }
    }

    if (market.asset_class === 6) {
      const keyword = elfa.trendIdToKeyword(market.identifier);
      if (!keyword) return 0;
      try {
        const res = await elfa.getKeywordMentions(keyword, "1h");
        return elfa.topMentionsToBps(res.metadata?.total ?? 0, 8);
      } catch {
        return 0;
      }
    }

    // CA: pakai latest trending_cas mention count
    return 0;
  }
}

export const oracleUpdater = new OracleUpdater();
