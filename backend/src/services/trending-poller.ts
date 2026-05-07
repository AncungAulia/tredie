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
    if (/^[A-Z]{6}$/.test(base)) return 4; // FX
    if (["XAU", "XAG", "CL", "NG", "HG", "ZW", "ZC"].includes(base)) return 3;
    return 2;
  }
  return 0;
}

export class TrendingPoller {
  start() {
    this.pollAll().catch((e) => log.error({ err: e }, "Initial poll failed"));
    cron.schedule("*/15 * * * *", () => {
      this.pollAll().catch((e) =>
        log.error({ err: e }, "Scheduled poll failed"),
      );
    });
    log.info("TrendingPoller started (every 15 min)");
  }

  async pollAll() {
    await Promise.allSettled([
      this.pollNarratives(),
      this.pollTokens(),
      this.pollCAs("twitter"),
      this.pollCAs("telegram"),
    ]);
  }

  /**
   * Discovery primitive untuk trend markets.
   * Setiap narrative cluster yang lolos slug + 32-byte check di-spawn sebagai
   * `trend:<slug>` market dengan asset_class=6.
   */
  async pollNarratives() {
    const res = await elfa.getTrendingNarratives("day", 10);
    let spawnedCount = 0;

    for (const item of res.narratives) {
      const trendId = elfa.normalizeTrendId(item.narrative);
      if (!trendId) {
        log.debug({ narrative: item.narrative }, "Narrative skipped (slug too long)");
        continue;
      }

      const existing = await db.getMarketByIdentifier(trendId);
      if (existing) continue;

      // Spawn market — trend markets gak punya threshold, semua narrative
      // yang muncul di top-10 hari itu langsung di-tokenize.
      marketSpawner
        .ensureMarket({
          identifier: trendId,
          assetClass: 6,
          source: "auto_spawn",
          displayName: item.narrative,
          sourceUrl: item.source_links?.[0] ?? null,
          sourceMetadata: { tweetIds: item.tweet_ids?.slice(0, 5) },
        })
        .catch((e) =>
          log.warn({ err: e, narrative: item.narrative }, "Trend spawn failed"),
        );
      spawnedCount++;
    }

    log.info(
      { totalNarratives: res.narratives.length, spawnAttempts: spawnedCount },
      "Trending narratives polled",
    );
  }

  async pollTokens() {
    const tokens = await elfa.getTrendingTokens("1h", 50);
    for (const [idx, token] of tokens.entries()) {
      // Elfa returns lowercase ("btc"), we normalize to uppercase to match
      // seeded identifiers (BTC) and avoid duplicate market spawns.
      const sym = token.token.toUpperCase();
      const mindshareBps = elfa.tokenMindshareBps(token, tokens);
      const mindsharePct = mindshareBps / 100;

      await db.upsertTrendingToken({
        symbol: sym,
        mention_count: token.current_count,
        mindshare_pct: mindsharePct,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      if (mindsharePct > config.AUTO_SPAWN_THRESHOLD_PCT) {
        const existing = await db.getMarketByIdentifier(sym);
        if (!existing) {
          marketSpawner
            .ensureMarket({
              identifier: sym,
              assetClass: detectAssetClass(sym),
              source: "auto_spawn",
            })
            .catch((e) =>
              log.warn({ err: e, symbol: sym }, "Auto-spawn failed"),
            );
        }
      }
    }
    log.info({ count: tokens.length }, "Trending tokens polled");
  }

  async pollCAs(platform: "twitter" | "telegram") {
    const cas =
      platform === "twitter"
        ? await elfa.getTrendingCAsTwitter("1h")
        : await elfa.getTrendingCAsTelegram("1h");

    for (const [idx, ca] of cas.entries()) {
      // Only spawn Solana-chain CAs (smart contract is on Solana)
      const isSolana = ca.chain === "solana";

      await db.upsertTrendingCA({
        contract_address: ca.contractAddress,
        source_platform: platform,
        mention_count: ca.mentionCount,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      if (isSolana) metadataEnricher.fetch(ca.contractAddress).catch(() => {});

      if (isSolana && ca.mentionCount > config.CA_SPAWN_THRESHOLD) {
        const existing = await db.getMarketByIdentifier(ca.contractAddress);
        if (!existing) {
          const meta = await db.getTokenMetadata(ca.contractAddress);
          marketSpawner
            .ensureMarket({
              identifier: ca.contractAddress,
              assetClass: 5,
              source: "auto_spawn",
              displayName: meta?.symbol ?? meta?.name ?? null,
              imageUrl: meta?.image_url ?? null,
            })
            .catch((e) =>
              log.warn(
                { err: e, ca: ca.contractAddress },
                "CA spawn failed",
              ),
            );
        }
      }
    }
    log.info({ platform, count: cas.length }, "Trending CAs polled");
  }
}

export const trendingPoller = new TrendingPoller();
