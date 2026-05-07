/**
 * Local hype detector — self-hosted condition engine that replaces Elfa Auto
 * webhook subscriptions. Runs every 15 min, scans trend markets, detects
 * keyword-mention surges, and boosts on-chain peak mindshare directly.
 *
 * Why this exists: Elfa Auto API rejects POST /v2/auto/queries on free tier
 * (and the chat scope needed to author queries via Builder isn't enabled
 * either). This bypasses that dependency entirely while delivering the same
 * PRD demo proof point ("Auto event annotation on chart"): events get logged
 * to mindshare_history with source='auto_event', frontend can render them
 * as special markers.
 *
 * Surge thresholds tuned for free-tier Elfa data (sparse mentions): trigger
 * if mentions ratio >= 1.5x previous OR absolute jump >= 200 bps.
 */

import cron from "node-cron";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../solana/connection";
import { oraclePda } from "../solana/pda";
import { decodeOracle } from "../solana/decoder";
import * as elfa from "../elfa/client";
import * as db from "../db";
import { buildUpdateMindshareTx, sendAndConfirm } from "../solana/instructions";
import { log } from "../utils/log";
import { config } from "../config";

const MINDSHARE_BPS_MAX = 100_000;
const ELASTICITY_BPS = 5000;
const RATCHET_BASE_BPS = 10_000;
const MAX_RATCHET_BPS = 50_000;

// Surge detection thresholds
const MIN_PREV_BPS = 50; // ignore very low baselines (signal noise)
const SURGE_RATIO = 1.5; // current >= 1.5x previous = surge
const ABSOLUTE_DELTA_BPS = 200; // OR absolute jump >= 200 bps
const ON_CHAIN_INTERVAL_BUFFER_SECS = 30;
const PER_MARKET_DELAY_MS = 300;

// Process-wide locks (survive bun --hot reloads)
declare global {
  // eslint-disable-next-line no-var
  var __tredieHypeDetectorRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __tredieHypeDetectorCronRegistered: boolean | undefined;
}

export class LocalHypeDetector {
  start() {
    if (globalThis.__tredieHypeDetectorCronRegistered) {
      log.debug("Hype detector cron already registered (hot reload), skip");
      return;
    }
    globalThis.__tredieHypeDetectorCronRegistered = true;
    // Cron offset 7 min from oracle-updater (which fires :00, :15, :30, :45)
    // so they don't bunch up RPC calls.
    cron.schedule("7,22,37,52 * * * *", () => {
      this.scanAll().catch((e) =>
        log.error({ err: e }, "Hype scan failed"),
      );
    });
    log.info("LocalHypeDetector started (every 15 min, offset 7m from oracle-updater)");
  }

  async scanAll() {
    if (globalThis.__tredieHypeDetectorRunning) {
      log.debug("Hype scan already in progress (process-wide), skipping");
      return;
    }
    globalThis.__tredieHypeDetectorRunning = true;
    const t0 = Date.now();
    let scanned = 0;
    let fired = 0;
    try {
      const allMarkets = await db.getAllActiveMarkets();
      // Trend markets only — for tickers, oracle-updater already runs the same
      // measurement loop. The thing local-hype-detector adds vs oracle-updater
      // is *surge detection* + *event boost*, which only makes sense for
      // markets whose primary signal is keyword-mentions volume (i.e. trends).
      const trendMarkets = allMarkets.filter((m) => m.asset_class === 6);

      for (const market of trendMarkets) {
        scanned++;
        try {
          const result = await this.scanOne(market);
          if (result === "fired") fired++;
        } catch (e) {
          log.warn(
            { err: e, identifier: market.identifier },
            "scanOne failed",
          );
        }
        if (PER_MARKET_DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, PER_MARKET_DELAY_MS));
        }
      }
    } finally {
      log.info(
        { scanned, fired, elapsedMs: Date.now() - t0 },
        "Local hype scan done",
      );
      globalThis.__tredieHypeDetectorRunning = false;
    }
  }

  /** Returns "fired" if hype event triggered + on-chain boost, else "no-surge"/"skipped". */
  async scanOne(
    market: db.MarketRow,
  ): Promise<"fired" | "no-surge" | "skipped"> {
    const keyword = elfa.trendIdToKeyword(market.identifier);
    if (!keyword) return "skipped";

    // 1) Get current measurement
    let currentBps: number;
    try {
      const res = await elfa.getKeywordMentions(keyword, "1h");
      currentBps = elfa.topMentionsToBps(res.metadata?.total ?? 0, 8);
    } catch (e) {
      log.debug(
        { err: e, identifier: market.identifier },
        "Elfa fetch failed",
      );
      return "skipped";
    }
    if (currentBps === 0) return "no-surge";

    // 2) On-chain interval check (avoid 0x1773)
    try {
      const [oraclePubkey] = oraclePda(new PublicKey(market.pda));
      const acc = await connection.getAccountInfo(oraclePubkey);
      if (acc) {
        const decoded = decodeOracle(acc.data);
        const nowSec = Math.floor(Date.now() / 1000);
        const elapsed = nowSec - Number(decoded.lastUpdateUnix);
        const minInterval =
          Number(decoded.minUpdateIntervalSecs) + ON_CHAIN_INTERVAL_BUFFER_SECS;
        if (elapsed < minInterval) {
          log.debug(
            { identifier: market.identifier, elapsed },
            "Oracle interval not elapsed — skip hype",
          );
          return "skipped";
        }
      }
    } catch {
      // proceed; tx-side check will catch real conflicts
    }

    // 3) Compare to last reading from mindshare_history
    const last = await db.getLastMindshareEntry(market.pda);
    const prev = last?.current_bps ?? 0;

    if (prev < MIN_PREV_BPS) {
      // No baseline yet — just record current, no boost. Future scans will
      // compare against this.
      log.debug(
        { identifier: market.identifier, currentBps, prev },
        "Below baseline — no surge detection yet",
      );
      return "no-surge";
    }

    const ratio = currentBps / Math.max(prev, 1);
    const delta = currentBps - prev;
    const isSurge = ratio >= SURGE_RATIO || delta >= ABSOLUTE_DELTA_BPS;

    if (!isSurge) return "no-surge";

    // 4) Surge detected — boost on-chain peak via update_mindshare
    const boostedBps = Math.min(
      MINDSHARE_BPS_MAX,
      currentBps + config.HYPE_EVENT_PREMIUM_BPS,
    );

    log.info(
      {
        identifier: market.identifier,
        prev,
        currentBps,
        ratio: Number(ratio.toFixed(2)),
        delta,
        boostedBps,
      },
      "🔥 Local hype event detected — boosting peak mindshare",
    );

    const tx = await buildUpdateMindshareTx({
      identifier: market.identifier,
      newMindshareBps: boostedBps,
    });
    const sig = await sendAndConfirm(tx);

    // Record as auto_event so frontend can render distinct annotation
    await db.appendMindshareHistory({
      market_pda: market.pda,
      current_bps: boostedBps,
      peak_bps: Math.max(market.peak_mindshare_bps, boostedBps),
      source: "auto_event",
      tx_signature: sig,
      recorded_at: BigInt(Date.now()),
    });

    // Update mirror
    const peak = Math.max(market.peak_mindshare_bps, boostedBps);
    const ratchet = Math.min(
      MAX_RATCHET_BPS,
      RATCHET_BASE_BPS + Math.floor((peak * ELASTICITY_BPS) / 10_000),
    );
    await db.updateMarketMindshare(market.pda, boostedBps, peak, ratchet);

    log.info(
      { identifier: market.identifier, sig, boostedBps },
      "Hype event tx confirmed",
    );

    return "fired";
  }

  /**
   * Force-fire a hype event for a specific market — useful for demos / testing
   * when real surges aren't happening yet (e.g. trend keyword has 0 mentions).
   * Uses provided bps or computes a default surge above current peak.
   */
  async forceFire(
    identifier: string,
    bpsOverride?: number,
  ): Promise<{ identifier: string; sig: string; boostedBps: number; peakBps: number }> {
    const market = await db.getMarketByIdentifier(identifier);
    if (!market) throw new Error(`Market "${identifier}" not in DB`);

    // Default: peak + boost (forces ratchet jump). Min 500 bps so something happens.
    const boostedBps = Math.min(
      MINDSHARE_BPS_MAX,
      bpsOverride ?? Math.max(market.peak_mindshare_bps + config.HYPE_EVENT_PREMIUM_BPS, 500),
    );

    const tx = await buildUpdateMindshareTx({
      identifier: market.identifier,
      newMindshareBps: boostedBps,
    });
    const sig = await sendAndConfirm(tx);

    await db.appendMindshareHistory({
      market_pda: market.pda,
      current_bps: boostedBps,
      peak_bps: Math.max(market.peak_mindshare_bps, boostedBps),
      source: "auto_event",
      tx_signature: sig,
      recorded_at: BigInt(Date.now()),
    });

    const peak = Math.max(market.peak_mindshare_bps, boostedBps);
    const ratchet = Math.min(
      MAX_RATCHET_BPS,
      RATCHET_BASE_BPS + Math.floor((peak * ELASTICITY_BPS) / 10_000),
    );
    await db.updateMarketMindshare(market.pda, boostedBps, peak, ratchet);

    log.info(
      { identifier, boostedBps, peak, ratchet, sig },
      "🔥 Hype event force-fired",
    );

    return { identifier, sig, boostedBps, peakBps: peak };
  }
}

export const localHypeDetector = new LocalHypeDetector();
